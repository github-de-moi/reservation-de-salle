import { isArray } from "util";

// helpers
const uuidv4 = require('uuid/v4');
const fs = require('fs');

const backupPath = '.';

/**
 * Matérialise une réservation.
 */
export class Reservation {

	readonly id: string;

	year(): number {
		return parseInt(this.date.substr(0, 4));
	}

	month(): number {
		return parseInt(this.date.substr(5, 2));
	}

	// date au format iso, debut et fin en minutes
	constructor(readonly date: string, readonly debut: number, readonly fin: number, readonly par_qui: string) {
		this.id = uuidv4();
	}
}

//  _         _                    
// | |_  ___ | | ___  ___  _ _  ___
// | . |/ ._>| || . \/ ._>| '_><_-<
// |_|_|\___.|_||  _/\___.|_|  /__/
//              |_|                
//

// compare deux réservations (ordre chronologique)
function compare(r1: Reservation, r2: Reservation) {
	let delta = (r1.date.localeCompare(r2.date));
	if(delta == 0) {
		delta = (r1.debut - r2.debut);
	}
	return delta;
}

// ___  ___  _ _  ___ 
// |  _>| . \| | || . \
// | <__|   /| ' || | |
// `___/|_\_\`___'|___/
//

// la base de donnée en mémoire
let inMemoryDatabase: { [key: string ]: Reservation} = {};

// delete est un mot clé réservé en js
// donc pas possible de l'utiliser comme
// nom de fonction, on utilise donc d3lete
// et pour pas que les autres soient jaloux,
// on les leet aussi ^^ 

export function g3t(y: number, m: number): Reservation[] {
	// let values = Object.values(db); ?!?
	let values: Reservation[] = [];
	Object.keys(inMemoryDatabase).forEach(function(key, index) {
		values.push(inMemoryDatabase[key]);
	});
	return values.filter(res => {
		return (res.year() == y && res.month() == m);
	});
}

export function cr3ate(r: Reservation): Reservation {
	if(inMemoryDatabase[r.id]) {
		throw "Une réservation avec cet identifiant existe déjà, utilisez update()"
	}
	inMemoryDatabase[r.id] = r;
	return r;
}

export function upd4te(r: Reservation): Reservation {
	if(!inMemoryDatabase[r.id]) {
		throw "Aucune réservation avec cet identifiant ?!?"
	}
	inMemoryDatabase[r.id] = r;
	return r;
}

export function d3lete(id: string): void {
	if(!inMemoryDatabase[id]) {
		throw "Aucune réservation avec cet identifiant ?!?"
	}
	delete inMemoryDatabase[id];
}

export function exp0rt(): Promise<number> {
	return new Promise((resolve, reject) => {
		const data = Object.values(inMemoryDatabase);
		fs.writeFile(backupPath + '/backup.json', JSON.stringify(data), function(err) {
			if (err) { reject(err); return; }
			resolve(data.length);
		}); 
	});
}

export function imp0rt(): Promise<number> {
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
					inMemoryDatabase = {};
					parsed.forEach(element => {
						// TODO remarshaller proprement les objets en vérifiant leur validité
						Object.setPrototypeOf(element, Reservation.prototype);
						inMemoryDatabase[element.id] = element;
					});
				}
				resolve(parsed.length);
			} catch(e /*SyntaxException*/) {
				reject(err);
			}

		});
	});
}

// EOF