import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { environment } from '../environments/environment';

//
// helpers exportés
//

/**
 * Convertit un nombre de minutes en heure "hh:mm".
 * @param {number} m Un nombre de minutes.
 * @returns L'heure correspondante ou null si input invalide.
 * @memberof AppComponent
 */
export function minutesToHour(m: number): string {
    if(m >= 1440) {
        return null;
    }
    return ('' + Math.floor(m/60)).padStart(2, '0') + ":" + ('' + Math.floor(m%60)).padStart(2, '0');
}

export function hourToMinutes(s: string): number {
    // TODO vérifier que l'input est sous la forme hh:mm ou pas loin ;-)
    return parseInt(s.substr(0, 2)) * 60 + parseInt(s.substr(3, 2));
}

/**
 * Vérifie et normalise une heure au format "hh'.'mm" ou "hh':'mm" ou "nn'h'mm".
 * @param str La chaîne à interpreter.
 * @returns La chaîne ajustée au bon format (2 chiffres, et ':' comme séparateur).
 * @throws Une description de l'erreur (string) si input incorrect.
 */
export function parseHourMinutes(str: string): string {

    let parts = (str || '').match(/([0-9]{1,2})[.:h]([0-9]{2})/);
    if(parts == null) {
        throw 'Heure incorrecte';
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

//
// helpers internes
//

function cast<T>(bean: any, clazz: { new(...args: any[]): T }): T {
    if(bean != null) {
        Object.setPrototypeOf(bean, clazz.prototype);
    }
    return (bean as T);
}

//
// exports
//

// une réservation reçue du serveur
// (version simplifiée)
export class Reservation {
    
    public commentaire: string = null;

    // ne peut être fourni que par le serveur
    readonly groupId: string;

    // date au format iso, debut et fin en minutes
	constructor(readonly id: string, readonly date: string, readonly debut: number, readonly fin: number, readonly par_qui: string) {
        // nop
	}
}

@Injectable({
    providedIn: 'root',
})
export class ReservationService {

    // constantes
    static readonly MIN_HOUR: string = '07:00';
    static readonly MAX_HOUR: string = '19:00';

    constructor(private http: HttpClient) {
        // nop
    }

    public set currentUser(u: string) {
        localStorage.setItem('qui', u);
    }

    /**
     * L'utilisateur "connecté".
     * @memberof ReservationService
     */
    public get currentUser(): string {
        return localStorage.getItem('qui');
    }

    // pas de getter, on utilise un json feed pour alimenter le calendrier ^^
    // sauf pour pouvoir récupérer les instances d'un même groupe (ci-dessous)

    public ofGroup(groupId: string): Observable<Reservation[]> {
        // le service renvoie un objet contenant l'id généré
        // et l'id de répétition si pertinent
		return this.http.get<Reservation[]>(environment.backendUrl + '/groups/' + groupId).pipe(
            tap(res => res.map(item => cast(item, Reservation)))
        );
	}

	public create(r: Reservation, numRepeat: number = 0): Observable<string> {
        // le service renvoie un objet contenant l'id généré
        // et l'id de répétition si pertinent
        let queryString = (numRepeat > 0 ? '?repeat=' + numRepeat : '');
		return this.http.post<{id: string, groupId?: string}>(environment.backendUrl + queryString, r).pipe(
            map(res => {
                (r as any).groupId = res.groupId;
                (r as any).id = res.id;
                return r.id;
            })
        );
	}

	public update(r: Reservation): Observable<void> {
		return this.http.put<any>(environment.backendUrl + '/' + r.id, r);
	}

    public delete(id: string, group: boolean): Observable<void> {
		return this.http.delete<any>(environment.backendUrl + '/' + (group ? 'groups/' + id : id));
	}

}