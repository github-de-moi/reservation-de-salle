import { Component, AfterViewInit, ViewChild } from '@angular/core';
import { ReservationService, Reservation } from './reservation.service';
import { NgForm } from '@angular/forms';
import { checkNoChangesNode } from '@angular/core/src/view/view';
import { isArray } from 'util';
import { environment } from 'src/environments/environment';

// jquery et fullcalendar importés via angular.json
// /!\ si importés deux fois, erreur chelou 
// jquery__WEBPACK_IMPORTED_MODULE_2__(...).modal is not a function
//import * as $ from "jquery";
//import 'fullcalendar';

// constantes
const MIN_HOUR: string = '07:00';
const MAX_HOUR: string = '19:00';

// alias
const $ = window['jQuery'];

// error TS2580: Cannot find name 'require'
// const moment = require('moment');
//declare var moment: (... args) => any;
import * as moment from 'moment';

// ajourd'hui
const today = () => moment().startOf('day');

/**
 * Sert à gérer le formulaire d'édition.
 * @export
 * @class Formulaire
 */
export class Formulaire {

  public id: string;

  public date: string;
  public debut: string;
  public fin: string;

  public par_qui: string;
  public commentaire: string = null;

  // le formulaire est-il modifiable ?
  public readOnly: boolean = false;

  // la dernière erreur survenur
  public error: string  = null;

  constructor(_id?: string) {
    this.id = _id;
  }

}

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit {

  @ViewChild('dialog-create-or-edit')
  form: NgForm;
  
	// https://codepen.io/chrisdpratt/pen/OOybam/

  formulaire: Formulaire = null;

  //
  // lifecycle
  //

  constructor(private resa: ReservationService) {
    // nop
  }

  ngAfterViewInit(): void {

    // identification de l'utilisateur
    // -> stocké en session (localStorage)
    if(this.currentUser == null) {
      let qui = window.prompt("Qui es-tu ?");
      if(qui == null) {
        // cancelled
        return;
      }
      if(qui.length > 1) {
        localStorage.setItem('qui', qui);
      }
      // refresh
      window.location.reload();
      return;
    }

    // (re) configuration du calendrier
		$('#calendar').fullCalendar({
			
      // toolbar
      header: {
        left: 'prev,next today',
        center: 'title',
        right: 'month,agendaWeek' // agendaDay ?
      },

      // on n'affiche pas la ligne "Toute la journée"
      // qui complique la gestion et n'est pas très
      // visuelle au niveau affichage
      allDaySlot: false,

      // un affichage en crénaux de 15 minutes
      // provoque un débordement vertical et
      // l'apparition d'une scrollbar :-(
      // on laisse donc 30 minutes et rien n'empêche
      // de spécifier une durée inférieure à la création
      // slotDuration: '00:15:00',
      
      // json feed
      eventSources: [
        {
          url: environment.backendUrl
        }
      ],

      // conversion réservation -> événement
      eventDataTransform: (resa: Reservation): any => {        
        return this.resaToEvent(resa);
      },

      // hook permettant d'ajuster le rendu d'un évènement
      // https://github.com/fullcalendar/fullcalendar/issues/3945
      eventRender: (event, element) => {

        // pas possible de modifier un évènement passé (géré dans le handler du click)
        // visuellement, il est grisé et n'a pas de croix de suppression
        // (event peut être null lors d'un drag'n'drop survolant une zone invalide)
        if(event.end == null || event.end.isBefore(today())) {
          return;
        }

        // seul l'owner peut supprimer une résa
        // donc pas de bras, pas de croix
        if(this.currentUser != event.metas.par_qui) {
          return;
        }

        // on ajoute la croix avant les autres éléments pour
        // qu'elle soit bien en haut à droite de la boîte
        // qq soit le mode d'affichage
        // <a class="fc-event ..." ...>
        //         <---- ici
        //    <div class="fc-content" ...>
        //    </div>
        // </a>
        element.find(".fc-content").prepend( "<span id=\"" + event.id + "\" class=\"delete\" aria-hidden=\"true\">&times;</span>" );
        element.find("span#" + event.id+".delete").click((mouseEvent) => {
          mouseEvent.stopPropagation();
          this.onDelete(event.id);
        });
        
      },

      // visu journalière par défaut
      defaultView: 'agendaWeek',

      // pas les week-ends
      weekends: false,

      // intervalle disponible
      minTime: MIN_HOUR,
      maxTime: MAX_HOUR,

      // date du jour par défaut (sera ajustée au prochain jour ouvré si besoin)
      defaultDate: moment(),

      // can click day/week names to navigate views
      navLinks: true,

      // création par click
      selectable: true,      
      select: (start, end) => {
        this.onCreate(start, end);
      },

      // sélection d'évènement
      eventClick: (event, jsEvent, view) => { 
        this.onEdit(event);
      },

      // allow "more" link when too many events
      eventLimit: true,

      // traduction
      locale: "fr",

      // les évènements sont modifiables à la souris
      editable: true,

      // limite la disponibilité du calendrier 
      // au mois en cours (les évènements en dehors
      // de cet intervalle ne seront même pas affichés)
      validRange: function(nowDate) {
        return {
          // début du mois en cours
          start: nowDate.clone().startOf('month'),
          end: nowDate.clone().add(6, 'months')
        };
      },

      // repositionnement
      eventDrop: (event, delta, revertFunc) => {
        this.onMove(event, revertFunc);
      },
      
      // redimmensionnement
      eventResize: (event, delta, revertFunc) => {
        this.onMove(event, revertFunc);
      }

		});

  }

  //
  // crud
  //

  private onCreate(start, end): void {

    // start et end sont des "moments" toujours ordonnés (start < end)
    // en vue "mois", l'heure n'est pas renseignée (logique ^^)
    
    // si la date est antérieure à la date du jour, on ne fait rien ^^
    if(start.isBefore(today())) {
      console.log('Pas possible de réserver pour une date passée');
      return;
    }

    // réutilisation de code ^^ 
    this.onEdit({
      start: start,
      end: end,
      metas: {
        commentaire: null,
        par_qui: this.currentUser
      }
    });

  }

  private onEdit(event: any) {

    // pas possible de modifier un évènement passé
    if(event.end.isBefore(today())) {
      return;
    }
    
    // marshalling
    this.formulaire = new Formulaire(event.id);
    
    this.formulaire.date = event.start.format('YYYY-MM-DD');
    // si heure == 0, c'est une réservation pour toute la journée
    this.formulaire.debut = (event.start.hour() > 0) ? event.start.format('HH:mm') : MIN_HOUR;
    this.formulaire.fin = (event.end.hour() > 0) ? event.end.format('HH:mm') : MAX_HOUR;

    this.formulaire.commentaire = event.metas.commentaire;
    this.formulaire.par_qui = event.metas.par_qui;

    // seul l'owner peut supprimer une résa
    this.formulaire.readOnly = (this.currentUser != event.metas.par_qui);
    
    // affichage du dialogue d'édition
    // (on attend qu'il soit créé ds le dom)
    setTimeout(() => {
      ($('#dialog-create-or-edit') as any).modal('show');
    }, 100);

  }

  private onMove(event: any, revertFunc): void {

    // les dates de début et fin de l'évènement sont déjà mises-à-jour
    // pas de gestion du allDay ici ^^
  
    // TODO gérer le fait que end peut être un autre jour que start
    let nouvelleDate = event.start.format('YYYY-MM-DD');

    // limite l'heure de début/fin à laplage horaire valide
    let min = event.start.clone().hour(parseInt(MIN_HOUR.substr(0, 2), 10)).minutes(parseInt(MIN_HOUR.substr(3, 2), 10));
    event.start = moment.max(event.start, min);

    // TODO utiliser event.end quand on gérera les réservations sur plusieurs journées 
    let max = event.start.clone().hour(parseInt(MAX_HOUR.substr(0, 2), 10)).minutes(parseInt(MAX_HOUR.substr(3, 2), 10));
    event.end = moment.min(event.end, max);

    // conversion en minutes des nouvelles heures de début et fin
    let debutEnMinutes: number = event.start.diff(event.start.clone().startOf('day'), 'minutes');
    let finEnMinutes: number = event.end.diff(event.end.clone().startOf('day'), 'minutes');

    // modification sur le backend
    let reservation = new Reservation(event.id, nouvelleDate, debutEnMinutes, finEnMinutes, event.metas.par_qui);
    reservation.commentaire = event.metas.commentaire;

    this.resa.update(reservation).subscribe((uid) => {

      // TODO comment réutilsier du code de resaToEvent() ?
      event.editable = !event.end.isBefore(today());
      if(!event.editable) {
        event.color = '#CCCCCC';
      }      

      // l'événement a déjà été bougé dans le calendrier ^^ mais 
      // on force une actualisation pour refléter les modifications éventuelles
      $('#calendar').fullCalendar('updateEvent', event);
      $('#calendar').fullCalendar('unselect');

    }, (error) => {
      console.error('erreur de sauvegarde', error);
      window.alert('erreur de sauvegarde');
      revertFunc();
    });
  }

  onSubmit(): void {

    this.formulaire.error = null;

    // vérification et normalisation des heures
    let heureDebut = this.parseHourMinutes(this.formulaire.debut);
    let heureFin = this.parseHourMinutes(this.formulaire.fin);

    if(this.formulaire.error) {
      return;
    }

    // conversion en minutes des heures de début et fin
    let debutEnMinutes: number = this.hourToMinutes(heureDebut);
    let finEnMinutes: number = this.hourToMinutes(heureFin);

    if(this.formulaire.id) {
      
      let reservation = new Reservation(this.formulaire.id, this.formulaire.date, debutEnMinutes, finEnMinutes, this.formulaire.par_qui);
      if(this.formulaire.commentaire && this.formulaire.commentaire.length > 0) {
        reservation.commentaire = this.formulaire.commentaire;
      }

      this.resa.update(reservation).subscribe((uid) => {        
        let events: any[] = $('#calendar').fullCalendar('clientEvents', this.formulaire.id);
        // on ne devrait avoir qu'un élément dans ce tableau
        if(events && events.length == 1) {
          // mise à jour du modèle (metas)
          events.map(event => {
            // TODO comment mutualiser le code avec celui de resaToEvent() ?
            event.title = (reservation.commentaire ? reservation.commentaire + ' - ' : '') + reservation.par_qui,
            event.metas.commentaire = this.formulaire.commentaire; 
            // le owner ne peut pas changer ^^
          });
          // mise à jour graphique
          $('#calendar').fullCalendar('updateEvent', events.shift());
        }

        // reset
        $("#dialog-create-or-edit").modal('hide');
        $('#calendar').fullCalendar('unselect');
        this.formulaire = null;

      }, (error) => {
        console.error('erreur de sauvegarde', error);
        window.alert('erreur de sauvegarde');
      });
      
    } else {

      // création de la réservation
      let reservation = new Reservation(null, this.formulaire.date, debutEnMinutes, finEnMinutes, this.currentUser);
      if(this.formulaire.commentaire) {
         reservation.commentaire = this.formulaire.commentaire;
      }

      this.resa.create(reservation).subscribe((uid) => {
        // affichage
        $('#calendar').fullCalendar('renderEvent', this.resaToEvent(reservation));

        // reset
        $("#dialog-create-or-edit").modal('hide');
        $('#calendar').fullCalendar('unselect');
        this.formulaire = null;

       }, (error) => {
         console.error('erreur de sauvegarde', error);
         window.alert('erreur de sauvegarde');
       });

    }
  }

  onCancel(): void {
    this.formulaire = null;
  }

  /**
   * Demande de suppression d'un évènement.
   * @memberof AppComponent
   */  
  private onDelete(id: string): void {
    this.formulaire = new Formulaire(id);
    setTimeout(() => {
      ($('#dialog-confirm-delete') as any).modal('show');
    }, 100);    
  }

  onDeleteConfirmed(): void {    
    this.resa.delete(this.formulaire.id).subscribe(() => {
      $('#calendar').fullCalendar('removeEvents', this.formulaire.id);
      this.formulaire = null;
    }, (error) => {
      console.error('erreur de suppression', error);
      window.alert('erreur de suppression :\'(');
    });
  }

  //
  // helpers
  //

  /**
   * L'utilisateur "connecté".
   * @memberof AppComponent
   */
  private get currentUser(): string {
    return localStorage.getItem('qui');
  }

  /**
   * Convertit un nombre de minutes en heure "hh:mm".
   * @param {number} m Un nombre de minutes.
   * @returns L'heure correspondante ou null si input invalide.
   * @memberof AppComponent
   */
  private minutesToHour(m: number): string {
    if(m >= 1440) {
      return null;
    }
    return ('' + Math.floor(m/60)).padStart(2, '0') + ":" + ('' + Math.floor(m%60)).padStart(2, '0');
  }

  private hourToMinutes(s: string): number {
    // TODO vérifier que l'input est sous la forme hh:mm ou pas loin ;-)
    return parseInt(s.substr(0, 2)) * 60 + parseInt(s.substr(3, 2));
  }

  //
  // helpers d'helpers
  //

  private resaToEvent(res: Reservation): any {

    // la réservation est-elle périmée ?
    let outdated = moment(res.date).isBefore(today());

    // on n'utilise pas la propriété allDay (i.e. journée entière)
    // (le calendrier hebdomadaire n'affiche d'ailleurs plus la zone)
    // parce qu'elle provoque l'affichage de l'évènement
    // en tout petit en haut de la journée ... pas très visuel

    // https://fullcalendar.io/docs/event-object

    let event = {
      id: res.id,
      
      // début/fin
      start: res.date + 'T' + this.minutesToHour(res.debut),
      end: res.date + 'T' + this.minutesToHour(res.fin),

      // apparence
      title: (res.commentaire ? res.commentaire + ' - ' : '') + res.par_qui,

      // la réservation n'est éditable que si elle est de moi et non passée
      editable: (res.par_qui === this.currentUser && !outdated),

      // données en plus qui seront
      // conservées avec l'événement :)
      metas: {
        par_qui: res.par_qui,
        commentaire: res.commentaire
      }
    };
    
    if(outdated) {
      // disabled
      event['color'] = '#CCCCCC';
    } else if(res.par_qui === this.currentUser) {
      // mes réservations à moi sont 
      // dans une couleur différente
      // pour sauter aux yeux :)
      // TODO la rendre personnalisable (pref)
      event['color'] = '#C8C8A9';
    }

    return event;
  }

  /**
   * Vérifie et normalise une heure au format "hh'.'mm" ou "hh':'mm" ou "nn'h'mm".
   * @param str 
   */
  private parseHourMinutes(str: string): string {
    
    let parts = (str || '').match(/([0-9]{1,2})[.:h]([0-9]{2})/);
    if(parts == null) {
      this.formulaire.error = "Heure incorrecte";
      return null;
    }

    let hours = parseInt(parts[1] || '');
    if(isNaN(hours) || hours < 0 || hours > 23) {
      throw 'heure invalide (' + parts[1] + ')';
    }

    let minutes = parseInt(parts[2] || '');
    if(minutes < 0 || minutes > 59) {
      throw 'minutes invalide (' + parts[2] + ')';
    }

    return ('' + hours).padStart(2, '0') + ':' + ('' + minutes).padStart(2, '0');

  }

}

