import { Component, EventEmitter, Output, Input } from '@angular/core';

import { ReservationService } from './reservation.service';

// alias
const $ = window['jQuery'];

/**
 * Donne des informations sur la suppression.
 */
export class Confirmation {
    constructor(readonly event: any, readonly all: boolean) {
        // nop
    }
}

/**
 * Gère le "formulaire" de suppression.
 */
class Formulaire {

    // output - supprimer tout ? (si répétition)
    public all: boolean = false;

    // input - l'id du groupe (si répétition)
    public groupId: string = null;

    constructor(readonly id: string) {
        // nop
    }

}

@Component({
	selector: 'confirm-delete-dialog',
	templateUrl: './confirm-delete.dialog.html',
	styleUrls: []
})
export class ConfirmDeleteDialog {

    @Output()
    public feedback = new EventEmitter<Confirmation>();
  
    @Input()
    set eventToDelete(event: any) {
        if((this.event = event) != null) {
            // préparation de l'affichage
            this.formulaire = new Formulaire(event.id);
            this.formulaire.groupId = event.metas.group_id || null;
            setTimeout(() => {
                $('#dialog-confirm-delete').modal('show');
            }, 100);

        }
    }

    //
    // members
    //

    public formulaire: Formulaire = null;
    
    private event: any = null;

    //
    // lifecycle
    //

    constructor(private resa: ReservationService) {
        // nop
    }

    //
    // API (interne)
    //

    /**
     * Appelé lorsque l'utilisateur a confirmé la suppression.
     */
    onConfirm(): void {

        console.log(this.formulaire);

        // avec gestion des répétitions ^^
        this.resa.delete(this.formulaire.all ? this.event.metas.group_id : this.event.id, this.formulaire.all).subscribe(() => {
            
            // masquage des la boîte de dialogue
            ($('#dialog-confirm-delete') as any).modal('hide');

            // notification du composant parent pour
            // mettre à jour le fullcalendar
            this.feedback.emit(new Confirmation(this.event, this.formulaire.all));
            this.formulaire = null;

        }, (error) => {
            const message = 'erreur de suppression ' + (this.formulaire.all ? 'de l\'événement' : 'du groupe');
            console.error(message, error);
            window.alert(message);
        });

    }

    onCancel(): void {
        this.feedback.emit(null);
        this.formulaire = null;
    }

}
