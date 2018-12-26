import { Component, AfterViewInit } from '@angular/core';
import { ReservationService, Reservation } from './reservation.service';

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
  // pour le moment, la date ne peut pas changer
  // seulement l'heure (car pas d'ihm pour ^^)
  public date: string;
  public debut: string;
  public fin: string;

  // le fiormulaire est-il modifiable ?
  public readOnly: boolean = false;

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
        right: 'month,agendaWeek,agendaDay'
      },
      
      // hook permettant d'ajuster le rendu d'un évènement
      // https://github.com/fullcalendar/fullcalendar/issues/3945
      eventRender: (event /*eventClick*/, element) => {
        // seul l'owner peut supprimer une résa
        // l'identifiant de l'utilisateur est
        // justement dans titre de l'évènement
        if(this.currentUser == event.title) {
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
            ///console.log('delete', event);
            mouseEvent.stopPropagation();
            this.onDelete(event.id);
          });
        }
      },

      // visu journalière par défaut
      defaultView: 'agendaDay',

      // pas les week-ends
      weekends: false,

      // date du jour par défaut (sera ajustée au prochain jour ouvré si besoin)
      defaultDate: aujourd_hui,

      // can click day/week names to navigate views
      navLinks: true,

      // création par click
      selectable: true,      
      select: (start, end) => {
        ///console.log('select', event);
        this.onCreate(start, end);
      },

      // sélection d'évènement
      eventClick: (event, jsEvent, view) => { 
        ///console.log('eventClick', event);
        this.onEdit('' + event.id);
      },

      // allow "more" link when too many events
      eventLimit: true,

      // traduction
      locale: "fr",

      // les évènements sont modifiables à la souris
      editable: true,

      // TODO validRange -> interdire hier ou avant

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

    const startDate = start.format();
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

    // marshalling
    this.enCours = new Formulaire();
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

    // modification
    let reservation = new Reservation(existing.id, nouvelleDate, debutEnMinutes, finEnMinutes, existing.par_qui);
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
    
    // TODO vérifier la validité des données saisies (debut et fin) !!
    
    // conversion en minutes des heures de début et fin
    let debutEnMinutes: number = this.hourToMinutes(this.enCours.debut);

    // extraction de l'heure de fin
    // et conversion en minutes
    let finEnMinutes: number = this.hourToMinutes(this.enCours.fin);

    if(this.enCours.id) {
      
      // la recherche ne devrait **jamais** renvoyer null ici inch'alla
      let existing = this.findResa(this.enCours.id);
      let reservation = new Reservation(existing.id, existing.date, debutEnMinutes, finEnMinutes, existing.par_qui);
      
      this.resa.update(reservation).subscribe((uid) => {
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
      this.resa.create(reservation).subscribe((uid) => {
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
  get currentUser(): string {
    return localStorage.getItem('qui');
  }

  /**
   * Convertit un nombre de minutes en heure "hh:mm".
   * @param {number} m Un nombre de minutes.
   * @returns L'heure correspondante ou null si input invalide.
   * @memberof AppComponent
   */
  minutesToHour(m: number): string {
    if(m >= 1440) {
      return null;
    }
    return ('' + Math.floor(m/60)).padStart(2, '0') + ":" + ('' + Math.floor(m%60)).padStart(2, '0');
  }

  hourToMinutes(s: string): number {
    // TODO vérifier que l'input est sous la forme hh:mm ou pas loin ;-)
    return parseInt(s.substr(0, 2)) * 60 + parseInt(s.substr(3, 2));
  }

  //
  // crud
  //

  addResa(res: Reservation): void {
    this.reservations.push(res);
    $('#calendar').fullCalendar('renderEvent', this.resaToEvent(res), /*stick?*/true); 
  }

  findResa(id: string): Reservation {
     // recherche de la réservation en local
    let filtered = this.reservations.filter(r => r.id === id);
    return (filtered.length == 1 ? filtered[0] : null);     
  }

  deleteResa(r: Reservation): void {
    let pos = this.reservations.indexOf(r);
    if(pos != -1) {
      $('#calendar').fullCalendar('removeEvents', r.id);
      this.reservations.splice(pos, 1);
    }
  }

  //
  // helpers d'helpers
  //

  resaToEvent(res: Reservation): any {
    // https://fullcalendar.io/docs/event-object
    return {
      id: res.id,
      start: res.date + 'T' + this.minutesToHour(res.debut),
      end: res.date + 'T' + this.minutesToHour(res.fin),
      title: res.par_qui
    };
  }

}

