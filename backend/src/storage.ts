import { isArray } from "util";
import { isoToDate, dateToIso } from "./helpers";

// config
const backupPath = '.';

// helpers
const uuidv4 = require('uuid/v4');
const fs = require('fs');

//  ___  _    ___  ___  ___  ___  ___ 
// |  _>| |  | . |/ __>/ __>| __>/ __>
// | <__| |_ |   |\__ \\__ \| _> \__ \
// `___/|___||_|_|<___/<___/|___><___/
//                                   

/**
 * Matérialise une réservation.
 */
export class Reservation {

	// pour gérer les répétitions
	public groupId: string = null;

	// le commentaire est optionnel
	public commentaire: string = null;

	// date au format iso, debut et fin en minutes
	constructor(readonly id: string, readonly date: string, readonly debut: number,
		readonly fin: number, readonly par_qui: string) {}
	
	public compareTo(other: Reservation): number {
		let result = this.date.localeCompare(other.date);
		if(result == 0) {
			// même jour, on utilise la date de début
			// pour départager les instances
			result = this.debut - other.debut;
			// si même heure de début, que faire ?
		}
		return result;
	}
	
	/**
	 * Répère la réservation 7 jours plus tard.
	 * La nouvelle instance est liée à l'ancienne
	 * par l'id de groupe (créé si besoin).
	 */
	public repeat(): Reservation {
		let dateDebut = isoToDate(this.date);
		dateDebut.setDate(dateDebut.getDate() + 7);
		// si pas d'id de groupe,
		// on en génère un qui sera
		// associé aux suivants
		if(!this.groupId) {
			this.groupId = uuidv4();
		}
		// on crée une nouvelle réservation
		// avec l'id de groupe
		let res = new Reservation(undefined, dateToIso(dateDebut), this.debut, this.fin, this.par_qui);
		res.commentaire = this.commentaire;
		res.groupId = this.groupId;
		return res;
	}

}

/**
 * Gère un stock de réservations.
 */
export class Reservations {

	// la base de donnée des réservations
	// la clé est l'identifiant de la résa
	private storage: { [key: string ]: Reservation} = {};

	has(id: string): boolean {
		return !!this.storage[id];
	}
	get(id: string): Reservation {
		return this.storage[id];
	}

	find(start: string, end: string): Reservation[] {
		let values: Reservation[] = [];
		Object.keys(this.storage).forEach((key, index) => {
			let reservation = this.storage[key];
			if((!start || start.substr(0, 10) <= reservation.date) && (!end || end.substr(0, 10) > reservation.date)) {
				values.push(reservation);
			}
		});
		return values;
	}

	// renvoie les réservations d'un même groupe par date croissante
	all(groupId: string): Reservation[] {
		let values: Reservation[] = [];
		Object.keys(this.storage).forEach((key, index) => {
			let reservation = this.storage[key];
			// on pourrait vérifier que la réservation n'est pas
			// périmée mais la purge aura déjà fait le ménage ^^ 
			if(reservation.groupId === groupId) {
				values.push(reservation);
			}
		});
		values.sort((r1: Reservation, r2: Reservation) => r1.compareTo(r2));
		return values;
	}

	create(r: Reservation): Reservation {
		if(r.id) {
			throw "La réservation ne doit pas avoir d'id, utilisez update() pour la persister";
		}
		(r as any).id = uuidv4();
		this.storage[r.id] = r;
		return r;
	}

	update(r: Reservation): Reservation {
		if(!r.id) {
			throw "La réservation doit avoir un id, utilisez create() pour la persister";
		}
		if(!this.has(r.id)) {
			throw "Aucune réservation avec cet identifiant (' + r.id + '), impossible de la mettre à jour"
		}

		if(r.groupId) {

			let today = dateToIso(new Date());

			// on récupére toutes les réservations (chronologiquement ordonnées)
			// du groupe mais on ne touche pas aux périmées
			let items = this.all(r.groupId).filter(item => item.date >= today);

			// on aurait pû supprimer les entrées non périmées
			// et les recréer de semaine en semaine avec le même id
			// mais il faut pour celà être sûr qu'il n'y a pas de « trous »
			// dans la liste initiale sinon on va tout décaler
		
			// pour être sûr, on doit donc calculer le delta entre la nouvelle
			// entrée et l'existant, et l'appliquer à toutes les non périmées
			let existing: Reservation = this.get(r.id);
			
			let dateInitiale = isoToDate(existing.date);
			let nouvelleDate = isoToDate(r.date);

			// typescript ne permet pas de faire (dateInitiale - nouvelleDate) ?!?
			let diff: number = (dateInitiale.getTime() - nouvelleDate.getTime());

			items.forEach(item => {
				let reservation = this.get(item.id);
				let date = isoToDate(reservation.date);
				// les méthodes setQqchose() de l'objet Date "roll" ^^
				// http://jsfiddle.net/Mn5Wz/
				date.setTime(date.getTime() + diff);
				(reservation as any).date = dateToIso(date);
				(reservation as any).debut = r.debut;
				(reservation as any).fin = r.fin;
				// la seule autre propriété à pouvoir changer
				reservation.commentaire = r.commentaire;
			});

		} else {
			// on écrase l'ancienne valeur SANS perdre le groupId
			r.groupId = this.storage[r.id].groupId;
			// ne devrait-on pas faire un update partiel ?
			this.storage[r.id] = r;
		}
		return r;
	}

	remove(id: string): void {
		if(!this.storage[id]) {
			throw "Aucune réservation avec cet identifiant, impossible de la supprimer"
		}
		delete this.storage[id];
	}

	removeGroup(id: string): void {
		let keys: string[] = [];
		Object.keys(this.storage).forEach((key, index) => {
			// TODO ne supprimer que les réservations à venir
			let reservation = this.storage[key];
			if(reservation.groupId === id) {
				keys.push(key);
			}
		});
		if(keys.length == 0) {
			throw "Aucun groupe de réservations avec cet identifiant, impossible de la supprimer"
		}
		keys.forEach(key => {
			delete this.storage[key];
		});
	}
	
	//
	// maintenance
	//

	purge(): number {
		let sevenDaysAgo = new Date();
		// on ne garde que 7 jours d'historique
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		const threshold = sevenDaysAgo.getFullYear() + '-' +
			('' + (sevenDaysAgo.getMonth() + 1)).padStart(2, '0') + '-' + 
			('' + sevenDaysAgo.getDate()).padStart(2, '0');

		console.log('Cleaning everything before ' + threshold);

		let toBeRemoved: string[] = [];
		// premier passage pour énumérer les clés à supprimer
		Object.keys(this.storage).forEach(function(key, index) {
			let resa = this.storage[key];
			if(resa.date < threshold) {
				toBeRemoved.push(key);
			}
		});
		// deuxième passage pour supprimer
		for(let key of toBeRemoved) {
			delete this.storage[key];
		}
		return toBeRemoved.length;
	}

	export(sync: boolean = false): Promise<number> {
		const data = Object.values(this.storage);
		if(sync) {
			// utilisé pour sauvegarder en fin de process
			fs.writeFileSync(backupPath + '/backup.json', JSON.stringify(data));
			return Promise.resolve(data.length);
		}
		return new Promise((resolve, reject) => {
			fs.writeFile(backupPath + '/backup.json', JSON.stringify(data), function(err) {
				if (err) { reject(err); return; }
				resolve(data.length);
			}); 
		});
	}

	import(): Promise<number> {
		return new Promise((resolve, reject) => {
			fs.readFile(backupPath + '/backup.json', (err, data) => {
				if (err) { 
					// gestion de l'absence de fichier ... qui n'est pas vraiment une erreur
					if(err.code == 'ENOENT') {
						resolve(0);
						return;
					}
					reject(err);
					return;
				}

				try {
					let parsed = JSON.parse(data);
					if(isArray(parsed)) {
						this.storage = {};
						parsed.forEach(element => {
							// TODO remarshaller proprement les objets en vérifiant leur validité
							Object.setPrototypeOf(element, Reservation.prototype);
							this.storage[element.id] = element;
						});
					}
					resolve(parsed.length);
				} catch(e /*SyntaxException*/) {
					reject(err);
				}

			});
		});
	}

}

// les préférences utilisateur
// pour le moment, seule la couleur
// des réservations est stockée
export class Preferences {

	private storage: { [ key: string ]: any} = {};

	get(username: string): any {
		return this.storage[username];
	}

	set(username: string, prefs: any): void {
		this.storage[username] = prefs;
	}

}

// EOF