import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../environments/environment';

//
// helpers
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
// TODO partager ce bean avec le serveur
export class Reservation {
    public commentaire: string = null;
    // date au format iso, debut et fin en minutes
	constructor(readonly id: string, readonly date: string, readonly debut: number, readonly fin: number, readonly par_qui: string) {
        // nop
	}
}

@Injectable({
    providedIn: 'root',
})
export class ReservationService {

    constructor(private http: HttpClient) {
        // nop
    }

    // pas de getter, on utilise un json feed pour alimenter le calendrier ^^

	public create(r: Reservation): Observable<string> {
        // le service renvoie un tableau contenant les ids dans l'ordre d'arrivée
		return this.http.post<{id: string}>(environment.backendUrl, r).pipe(
            map(result => {
                (r as any).id = result.id;
                return r.id;
            })
        );

	}

	public update(r: Reservation): Observable<any> {
		return this.http.put<string[]>(environment.backendUrl + '/' + r.id, r);
	}

    public delete(id: string): Observable<any> {
		return this.http.delete(environment.backendUrl + '/' + id);
	}

}