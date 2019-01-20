import { Component, AfterViewInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';

import { environment } from 'src/environments/environment';
import { ReservationService, Reservation, minutesToHour } from './reservation.service';
import { Confirmation } from './confirm-delete.dialog';

// jquery et fullcalendar sont importés via angular.json
// import * as $ from "jquery";
// import 'fullcalendar';
// /!\ si importés deux fois, erreur chelou 
// jquery__WEBPACK_IMPORTED_MODULE_2__(...).modal is not a function

// alias
const $ = window['jQuery'];

// error TS2580: Cannot find name 'require'
// const moment = require('moment');
// declare var moment: (... args) => any;
import * as moment from 'moment';
import { Edition } from './edit-event.dialog';

// ajourd'hui (recalculé à chaque appel)
const today = () => moment().startOf('day');

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit {

  // https://codepen.io/chrisdpratt/pen/OOybam/

  // l'événement à créer/modifier (si non null)
  eventToEdit: any = null;

  // l'évènement à supprimer (si non null)
  eventToDelete: any = null;
  
  //
  // lifecycle
  //

  constructor(private service: ReservationService) {
    // nop
  }

  ngAfterViewInit(): void {

    // identification de l'utilisateur
    // -> stocké en session (localStorage)
    if(this.service.currentUser == null) {
      let qui = window.prompt("Qui es-tu ?");
      if(qui == null) {
        // cancelled
        return;
      }
      if(qui.length > 1) {
        this.service.currentUser = qui;
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
        if(this.service.currentUser != event.metas.par_qui) {
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
      minTime: ReservationService.MIN_HOUR,
      maxTime: ReservationService.MAX_HOUR,

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
  // actions
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
        par_qui: this.service.currentUser,
        commentaire: null
      }
    });

  }

  private onEdit(event: any) {

    // pas possible de modifier un évènement passé
    if(event.end.isBefore(today())) {
      return;
    }
    // on délègue le travail ^^
    this.eventToEdit = event;
  }

  private onMove(event: any, revertFunc): void {

    // les dates de début et fin de l'évènement sont déjà mises-à-jour
    // pas de gestion du allDay ici ^^
  
    // TODO gérer le fait que end peut être un autre jour que start
    let nouvelleDate = event.start.format('YYYY-MM-DD');

    // limite l'heure de début/fin à laplage horaire valide
    let min = event.start.clone().hour(parseInt(ReservationService.MIN_HOUR.substr(0, 2), 10)).minutes(parseInt(ReservationService.MIN_HOUR.substr(3, 2), 10));
    event.start = moment.max(event.start, min);

    // TODO utiliser event.end quand on gérera les réservations sur plusieurs journées 
    let max = event.start.clone().hour(parseInt(ReservationService.MAX_HOUR.substr(0, 2), 10)).minutes(parseInt(ReservationService.MAX_HOUR.substr(3, 2), 10));
    event.end = moment.min(event.end, max);

    // conversion en minutes des nouvelles heures de début et fin
    let debutEnMinutes: number = event.start.diff(event.start.clone().startOf('day'), 'minutes');
    let finEnMinutes: number = event.end.diff(event.end.clone().startOf('day'), 'minutes');

    // modification sur le backend
    let reservation = new Reservation(event.id, nouvelleDate, debutEnMinutes, finEnMinutes, event.metas.par_qui);
    reservation.commentaire = event.metas.commentaire;

    // devrait-on gérer les répétitions ici ? à priori non
    // pour modifier toutes les instances, il faut passer
    // par la boîte de dialogue de modification
    // donc reservation.groupId = undefined;

    this.service.update(reservation).subscribe((uid) => {

      // TODO comment réutiliser du code de resaToEvent() ?
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

  /**
   * Demande de suppression d'un évènement.
   * @param id L'identifiant de l'événement.
   * @memberof AppComponent
   */  
  onDelete(id: string): void {
    // recherche de l'évènement dans le cache local (géré par le calendar)
    let events: any[] = $('#calendar').fullCalendar('clientEvents', id);
    if(events.length == 1) {
      this.eventToDelete = events.shift();
    }
  }

  //
  // feedback des boîtes de dialogue
  //

  onEditFeedback(edition: Edition): void {
    
    // annulé ?
    if(edition == null) { 
      this.eventToEdit = null;
      return;
    }

    if(edition.created) {
      // gestion des répétitions
      if(edition.resa.groupId != null) {
        // on charge tout le groupe, tant pis pour le gâchis
        // (les entrées en dehors de l'intervalle actif ne seront pas affichées)
        this.service.ofGroup(edition.resa.groupId).subscribe((reservations) => {
          reservations.forEach(reservation => {
            $('#calendar').fullCalendar('renderEvent', this.resaToEvent(reservation));
          });
        });
      } else {
        // ajoute l'événement dans le calendrier
        $('#calendar').fullCalendar('renderEvent', this.resaToEvent(edition.resa));
      }    
    } else {
      // gestion des répétitions
      if(edition.resa.groupId != null) {
        // on va faire simple : on met tout à jour
        $('#calendar').fullCalendar('refetchEvents');
      } else {
        // récupération de l'événement originel
        let events: any[] = $('#calendar').fullCalendar('clientEvents', edition.resa.id);
        // on ne devrait avoir qu'un élément dans ce tableau
        if(events && events.length == 1) {
          // mise à jour du modèle (metas)
          events.map(event => {
            // TODO comment mutualiser le code avec celui de resaToEvent() ?
            event.title = (edition.resa.commentaire ? edition.resa.commentaire + ' - ' : '') + edition.resa.par_qui,
            event.metas.commentaire = edition.resa.commentaire; 
            // le owner ne peut pas changer ^^
          });
          $('#calendar').fullCalendar('updateEvent', events.shift());
        }
      }
    }

    $('#calendar').fullCalendar('unselect');

  }

  /**
   * La suppression a été confirmée ou pas.
   * @param confirmed Les infos sur l'évènement
   *  à supprimer, null si abandon.
   */
  onDeleteFeedback(confirmation: Confirmation): void {
    
    // annulé ?
    if(confirmation == null) { 
      this.eventToDelete = null;
      return;
    }

    // la suppression est confirmée et effective
    // (les données sont à jour sur le backend)

    if(confirmation.all) {
      // suppression d'un groupe
      let toBeRemoved: string[] = [];
      // recherche dans les événements en local de
      // tous les éléments faisant partie du groupe
      // et mémorise leur id dans une liste
      $('#calendar').fullCalendar('clientEvents').forEach(element => {
          if(element.metas.group_id === confirmation.event.metas.group_id) {
              toBeRemoved.push(element.id);
          }
      });
      // suppression un par un
      toBeRemoved.forEach(element => {
          $('#calendar').fullCalendar('removeEvents', element);
      });

    } else {
        // suppression unitaire
        $('#calendar').fullCalendar('removeEvents', confirmation.event.id);
    }
  }

  //
  // helpers graphiques
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
      start: res.date + 'T' + minutesToHour(res.debut),
      end: res.date + 'T' + minutesToHour(res.fin),

      // apparence
      title: (res.commentaire ? res.commentaire + ' - ' : '') + res.par_qui,

      // la réservation n'est éditable que si elle est de moi et non passée
      editable: (res.par_qui === this.service.currentUser && !outdated),

      // données en plus qui seront
      // conservées avec l'événement :)
      metas: {
        par_qui: res.par_qui,
        commentaire: res.commentaire,
        group_id: res.groupId
      }
    };
    
    if(outdated) {
      // disabled
      event['color'] = '#CCCCCC';
    } else if(res.par_qui === this.service.currentUser) {
      // mes réservations à moi sont 
      // dans une couleur différente
      // pour sauter aux yeux :)
      // TODO la rendre personnalisable (pref)
      event['color'] = '#C8C8A9';
    }

    return event;
  }

}

