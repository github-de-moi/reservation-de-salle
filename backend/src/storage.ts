import { isArray } from "util";

// helpers
const uuidv4 = require('uuid/v4');
const fs = require('fs');

// config
const backupPath = '.';

//  ___  _    ___  ___  ___  ___  ___ 
// |  _>| |  | . |/ __>/ __>| __>/ __>
// | <__| |_ |   |\__ \\__ \| _> \__ \
// `___/|___||_|_|<___/<___/|___><___/
//                                   

/**
 * Matérialise une réservation.
 */
export class Reservation {

	// le commentaire est optionnel
	public commentaire: string = null;

	// date au format iso, debut et fin en minutes
	constructor(readonly id: string, readonly date: string, readonly debut: number,
		readonly fin: number, readonly par_qui: string) {}

}

/**
 * Gère un stock de réservations.
 */
export class Reservations {

	// la base de donnée des réservations
	// la clé est l'identifiant de la résa
	private storage: { [key: string ]: Reservation} = {};

	find(start: string, end: string): Reservation[] {
		// let values = Object.values(db); ?!?
		let values: Reservation[] = [];
		Object.keys(this.storage).forEach((key, index) => {
			let reservation = this.storage[key];
			if((!start || start.substr(0, 10) <= reservation.date) && (!end || end.substr(0, 10) > reservation.date)) {
				values.push(reservation);
			}
		});
		return values;
	}

	create(r: Reservation): Reservation {
		// TODO vérifier la validité des données fournies
		if(this.storage[r.id]) {
			throw "Une réservation avec cet identifiant existe déjà, utilisez update()"
		}
		this.storage[r.id] = r;
		return r;
	}

	update(r: Reservation): Reservation {
		// TODO vérifier la validité des données fournies
		if(!this.storage[r.id]) {
			throw "Aucune réservation avec cet identifiant ?!?"
		}
		this.storage[r.id] = r;
		return r;
	}

	remove(id: string): void {
		if(!this.storage[id]) {
			throw "Aucune réservation avec cet identifiant ?!?"
		}
		delete this.storage[id];
	}

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