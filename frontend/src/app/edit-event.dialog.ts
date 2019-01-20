import { Component, EventEmitter, Output, Input, ViewChild } from '@angular/core';

import { ReservationService, parseHourMinutes, Reservation, hourToMinutes } from './reservation.service';
import { NgForm } from '@angular/forms';

// alias
const $ = window['jQuery'];

/**
 * Donne des informations sur l'édition.
 */
export class Edition {
    constructor(readonly resa: Reservation, readonly created: boolean) {
        // nop
    }
}

/**
 * Gère le "formulaire" de création/modification.
 */
class Formulaire {

    readonly id: string;
  
    // quand ?
    public date: string;
    public debut: string;
    public fin: string;
  
    // metas
    public par_qui: string;
    public commentaire: string = null;
    
    // répétition ?
    public repeat: boolean = false;
    // nb d'itérations (en création uniquement)
    public iterations: string;
    // identifiant de groupe (en modification uniquement)
    public groupId: string;
  
    // le formulaire est-il modifiable ?
    public readOnly: boolean = false;
  
    // la description de la dernière
    // erreur survenue ou null si aucune
    public error: string  = null;
  
    constructor(_id?: string) {
        this.id = _id;
    }
  
}

@Component({
	selector: 'edit-event-dialog',
	templateUrl: './edit-event.dialog.html',
	styleUrls: []
})
export class EditEventDialog {

    @Output()
    public feedback = new EventEmitter<Edition>();
  
    @Input()
    set eventToEdit(event: any) {
        if(event != null) {
            // préparation de l'affichage
            let formulaire = new Formulaire(event.id);
            
            formulaire.date = event.start.format('YYYY-MM-DD');

            // si heure == 0, c'est une réservation pour toute la journée
            formulaire.debut = (event.start.hour() > 0) ? event.start.format('HH:mm') : ReservationService.MIN_HOUR;
            formulaire.fin = (event.end.hour() > 0) ? event.end.format('HH:mm') : ReservationService.MAX_HOUR;

            // méta-données
            formulaire.commentaire = event.metas.commentaire;
            formulaire.par_qui = event.metas.par_qui;

            // répétition (création/modification)
            formulaire.groupId = event.metas.group_id;
            formulaire.repeat = event.metas.group_id || false;
            formulaire.iterations = null;

            // seul l'owner peut supprimer une résa
            formulaire.readOnly = (this.service.currentUser != event.metas.par_qui);
            
            // andiamo !
            this.formulaire = formulaire;

            // affichage du dialogue d'édition
            // (on attend qu'il soit créé ds le dom)
            setTimeout(() => {
                $('#dialog-create-or-edit').modal('show');
            }, 100);
        }
    }

    //
    // members
    //

    @ViewChild('dialog-create-or-edit')
    form: NgForm;  

    formulaire: Formulaire = null;
    
    //
    // lifecycle
    //

    constructor(private service: ReservationService) {
        // nop
    }

    //
    // API (interne)
    //

    onSubmit(): void {

        // TODO cet algo est dégueu !
    
        let heureDebut: string = null;
        let heureFin: string = null;
    
        // reset
        this.formulaire.error = null;
    
        try {
          
          // vérification et normalisation des heures
          heureDebut = parseHourMinutes(this.formulaire.debut);
          heureFin = parseHourMinutes(this.formulaire.fin);
          
          if(this.formulaire.repeat && !this.formulaire.groupId && isNaN(parseInt(this.formulaire.iterations))) {
            throw "nombre de répétitions incorrect";
          }
    
        } catch(str) {
          this.formulaire.error = str;
          return;
        }
        
        // conversion en minutes des heures de début et fin
        let debutEnMinutes: number = hourToMinutes(heureDebut);
        let finEnMinutes: number = hourToMinutes(heureFin);
    
        if(this.formulaire.id) {
          
            let reservation = new Reservation(this.formulaire.id, this.formulaire.date, debutEnMinutes, finEnMinutes, this.formulaire.par_qui);
            if(this.formulaire.commentaire && this.formulaire.commentaire.length > 0) {
                reservation.commentaire = this.formulaire.commentaire;
            }
            if(this.formulaire.repeat) {
                // mise à jour de toutes les instances non périmées du groupe ?
                (reservation as any).groupId = this.formulaire.groupId;
            }
    
            this.service.update(reservation).subscribe((uid) => {
                this.feedback.emit(new Edition(reservation, false));
                // masquage du formulaire et reset
                $("#dialog-create-or-edit").modal('hide');
                this.formulaire = null;
    
            }, (error) => {
                console.error('erreur de sauvegarde', error);
                window.alert('erreur de sauvegarde');
            });
          
        } else {
    
            // création de la réservation
            let reservation = new Reservation(null, this.formulaire.date, debutEnMinutes, finEnMinutes, this.service.currentUser);
            if(this.formulaire.commentaire) {
                reservation.commentaire = this.formulaire.commentaire;
            }

            let numRepeat: number = (this.formulaire.repeat ? parseInt(this.formulaire.iterations) : 0);
            this.service.create(reservation, numRepeat).subscribe((uid) => {

                // TODO mettre à jour le groupId si beoin

                this.feedback.emit(new Edition(reservation, true));
                // masquage du formulaire et reset
                $("#dialog-create-or-edit").modal('hide');
                this.formulaire = null;

            }, (error) => {
                console.error('erreur de sauvegarde', error);
                window.alert('erreur de sauvegarde');
            });
    
        }
    }
    
    onCancel(): void {
        this.feedback.emit(null);
        this.formulaire = null;
    }

}
