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

// alias
const $ = window['jQuery'];

// constante --> /!\ bug si l'application reste chargée toute la nuit :-p
const aujourd_hui = (new Date()).toISOString().substr(0, 10);

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

  public commentaire: string = null;

  // le formulaire est-il modifiable ?
  public readOnly: boolean = false;

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

  enCours: Formulaire = null;

	// les réservations (cache local)
	private reservations : Reservation[] = new Array();

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
      
      //eventSources: [
      //  {
      //    url: environment.backendUrl,
      //    color: 'yellow'    // an option!
      //  }
      //],

      eventDataTransform: (event: Reservation): any => {
        console.log('eventDataTransform', event);
        return event;
      },

      // hook permettant d'ajuster le rendu d'un évènement
      // https://github.com/fullcalendar/fullcalendar/issues/3945
      eventRender: (event, element) => {

        console.log('eventRender', event);

        // pas possible de modifier un évènement passé (géré dans le handler du click)
        // visuellement, il est grisé et n'a pas de croix de suppression
        let resa = this.findResa(event.id);
        if(resa.date < aujourd_hui) {
          return;
        }

        // seul l'owner peut supprimer une résa
        // donc pas de bras, pas de croix
        if(this.currentUser != resa.par_qui) {
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
      minTime: '07:00:00',
      maxTime: '19:00:00',

      // date du jour par défaut (sera ajustée au prochain jour ouvré si besoin)
      defaultDate: aujourd_hui,

      // can click day/week names to navigate views
      navLinks: true,

      // création par click
      selectable: true,      
      select: (start, end) => {
        this.onCreate(start, end);
      },

      // sélection d'évènement
      eventClick: (event, jsEvent, view) => { 
        this.onEdit('' + event.id);
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
          start: nowDate.format().substr(0, 8) + '01',
          end: '2999-12-31'
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

    // chargement (asynchrone) des réservations
    // déjà effectuées pour le mois en cours
    this.resa.get().subscribe((data) => {
      data.forEach(res => this.addResa(res));
      // this.reservations = data; --> déjà fait par addResa() ^^
    }, (error) => {
      ///console.log('erreur de chargeemnt', error);
      window.alert('erreur de chargeemnt :\'( ');
    });

  }

  //
  // gestion des dialogues
  //

  onCreate(start, end): void {
    
    // start et end dépendent de la vue
    // en visu semaine, on reçoit des dates (iso)
    // exemple : 2018-12-03 / 2018-12-04
    // et en visu jour, on reçoit date+heure
    // exemple : 2018-12-21T06:00:00 / 2018-12-21T06:30:00
    // dans tous les cas, les dates sont ordonnées :-)

    const startDate = start.format();
    const endDate = end.format();

    console.log(startDate, endDate)

    this.enCours = new Formulaire();
    this.enCours.date = startDate.substr(0, 10);

    // si la date est antérieure à la date du jour, on ne fait rien ^^
    if(this.enCours.date < aujourd_hui) {
      console.log('Pas possible de réserver pour une date passée');
      return;
    }

    if(startDate.length > 0) {
      this.enCours.debut = startDate.substr(11, 5);
      this.enCours.fin = end.format().substr(11, 5);
    }

    // affichage du dialogue d'édition
    // (on attend qu'il soit créé ds le dom)
    setTimeout(() => {
      ($('#dialog-create-or-edit') as any).modal('show');
    }, 100);

  }

  onEdit(id: string) {
    // recherche de la réservation en local
    let resa = this.findResa(id);
    if(resa == null) {
      console.error('réservation ' + id + ' inexistante ?!?');
      return;
    }

    if(resa.date < aujourd_hui) {
      return;
    }

    // marshalling
    this.enCours = new Formulaire();
    this.enCours.commentaire = resa.commentaire;
    this.enCours.debut = this.minutesToHour(resa.debut);
    this.enCours.fin = this.minutesToHour(resa.fin);
    this.enCours.date = resa.date;
    this.enCours.id = resa.id;

    // seul l'owner peut supprimer une résa
    this.enCours.readOnly = (this.currentUser != resa.par_qui);
    
    // affichage du dialogue d'édition
    // (on attend qu'il soit créé ds le dom)
    setTimeout(() => {
      ($('#dialog-create-or-edit') as any).modal('show');
    }, 100);

  }

  onMove(event: any, revertFunc): void {
    // la recherche ne devrait **jamais** renvoyer null ici inch'alla
    const existing = this.findResa(event.id);

    // récupération de la (nouvelle ?) date 
    let nouvelleDate = event.start.format().substr(0, 10);

    // conversion en minutes des nouvelles heures de début et fin
    let debutEnMinutes: number = this.hourToMinutes(event.start.format().substr(11, 5));
    let finEnMinutes: number = this.hourToMinutes(event.end.format().substr(11, 5));

    // modification (TODO copy constructor)
    let reservation = new Reservation(existing.id, nouvelleDate, debutEnMinutes, finEnMinutes, existing.par_qui);
    reservation.commentaire = existing.commentaire;

    this.resa.update(reservation).subscribe((uid) => {
      this.deleteResa(existing);
      this.addResa(reservation);
      this.enCours = null;

      $('#calendar').fullCalendar('unselect');
    }, (error) => {
      console.error('erreur de sauvegarde', error);
      window.alert('erreur de sauvegarde');
      revertFunc();
    });
  }

  onSubmit(): void {

    this.enCours.error = null;

    // vérification et normalisation des heures
    let heureDebut = this.parseHourMinutes(this.enCours.debut);
    let heureFin = this.parseHourMinutes(this.enCours.fin);

    if(this.enCours.error) {
      return;
    }

    // conversion en minutes des heures de début et fin
    let debutEnMinutes: number = this.hourToMinutes(heureDebut);

    // extraction de l'heure de fin
    // et conversion en minutes
    let finEnMinutes: number = this.hourToMinutes(heureFin);

console.log(this.enCours);

    if(this.enCours.id) {
      
      // la recherche ne devrait **jamais** renvoyer null ici inch'alla
      let existing = this.findResa(this.enCours.id);
      let reservation = new Reservation(existing.id, existing.date, debutEnMinutes, finEnMinutes, existing.par_qui);
      if(this.enCours.commentaire) {
        reservation.commentaire = this.enCours.commentaire;
      }

      this.resa.update(reservation).subscribe((uid) => {
        $("#dialog-create-or-edit").modal('hide');
        this.deleteResa(existing);
        this.addResa(reservation);
        this.enCours = null;

        $('#calendar').fullCalendar('unselect');
      }, (error) => {
        console.error('erreur de sauvegarde', error);
        window.alert('erreur de sauvegarde');
      });
      
    } else {
      let reservation = new Reservation(null, this.enCours.date, debutEnMinutes, finEnMinutes, this.currentUser);
      if(this.enCours.commentaire) {
        reservation.commentaire = this.enCours.commentaire;
      }

      this.resa.create(reservation).subscribe((uid) => {
        $("#dialog-create-or-edit").modal('hide');
        // l'id du bean est déjà mis-à-jour ^^         
        this.addResa(reservation);
        this.enCours = null;

        $('#calendar').fullCalendar('unselect');
      }, (error) => {
        console.error('erreur de sauvegarde', error);
        window.alert('erreur de sauvegarde');
      });

    }
  }

  onCancel(): void {
    this.enCours = null;
  }

  /**
   * Demande de suppression d'un évènement.
   * @memberof AppComponent
   */  
  onDelete(id: string): void {
    this.enCours = new Formulaire(id);
    setTimeout(() => {
      ($('#dialog-confirm-delete') as any).modal('show');
    }, 100);    
  }

  onDeleteConfirmed(): void { 
    let resa = this.findResa(this.enCours.id);
    this.resa.delete(resa.id).subscribe(() => {
      this.deleteResa(resa);
      this.enCours = null;
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
  // crud
  //

  private addResa(res: Reservation): void {
    this.reservations.push(res);
    $('#calendar').fullCalendar('renderEvent', this.resaToEvent(res), /*stick?*/true); 
  }

  private findResa(id: string): Reservation {
     // recherche de la réservation en local
    let filtered = this.reservations.filter(r => r.id === id);
    return (filtered.length == 1 ? filtered[0] : null);     
  }

  private deleteResa(r: Reservation): void {
    let pos = this.reservations.indexOf(r);
    if(pos != -1) {
      $('#calendar').fullCalendar('removeEvents', r.id);
      this.reservations.splice(pos, 1);
    }
  }

  //
  // helpers d'helpers
  //

  private resaToEvent(res: Reservation): any {
    // la réservation est-elle périmée ?
    let outdated = (res.date < aujourd_hui);

    // https://fullcalendar.io/docs/event-object
    let event = {
      id: res.id,
      start: res.date + 'T' + this.minutesToHour(res.debut),
      end: res.date + 'T' + this.minutesToHour(res.fin),
      title: (res.commentaire ? res.commentaire + ' - ' : '') + res.par_qui,
      // la réservation n'est éditable que si elle est de moi et non passée
      editable: (res.par_qui === this.currentUser && !outdated)
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
      this.enCours.error = "Heure incorrecte";
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

