
//  _         _                    
// | |_  ___ | | ___  ___  _ _  ___
// | . |/ ._>| || . \/ ._>| '_><_-<
// |_|_|\___.|_||  _/\___.|_|  /__/
//              |_|                
//

// détermine si une chaîne est un uuid valide
export function isUuid(s: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// détermine si une chaîne est une date valide (en format iso)
export function isIsoDate(s: string): boolean {
	return /^20[0-9]{2}-(0[1-9]|1[0-2])-[0-9]{2}$/.test(s);
}

export function isoToDate(str: string): Date {
	return new Date(parseInt(str.substr(0, 4)), parseInt(str.substr(5, 2)) - 1, parseInt(str.substr(8, 2)));
}

export function dateToIso(d: Date): string {
	return d.getFullYear() + '-' + ('' + (d.getMonth() + 1)).padStart(2, '0') + '-' + ('' + d.getDate()).padStart(2, '0');
}

