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
export class Reservation {
    // date au format iso, debut et fin en minutes
	constructor(readonly id: string, readonly date: string, readonly debut: number, readonly fin: number, readonly par_qui: string) {
	}
}

@Injectable({
    providedIn: 'root',
})
export class ReservationService {

    constructor(private http: HttpClient) {
        // nop
    }

	public get(y?: number, m?: number): Observable<Reservation[]> {

        let params = new HttpParams();
        if(y) params.set('y', '' + y);
        if(m) params.set('m', '' + m);

		return this.http.get<Reservation[]>(environment.backendUrl, {
            params: params
        }).pipe(
            map(res => {
                // conversion en "vrai" bean
                res.map(bean => cast(bean, Reservation));
                return res;
            })
        );

	}

	public create(r: Reservation): Observable<string> {
        // le service renvoie un tableau contenant les ids dans l'ordre d'arrivée
		return this.http.post<string[]>(environment.backendUrl, r).pipe(
            map(res => {
                (r as any).id = res.shift();
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