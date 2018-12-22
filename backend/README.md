
# Réservation de salle (backend)

Expose les services de gestion des réservations et stocke les données.

## Fonctionnement

Les données sont stockées en mémoire dans une map (implémentée par un objet _vanilla_). Si le serveur plante ou est _killé_, elles sont perdues. Le service `/backup` permet de sérialiser les données sur disque dans un fichier json. Le fichier (s'il existe) est chargé au prochain démarrage du serveur.

Le backend est écrit en [TypeScript](https://www.typescriptlang.org).

## Dépendances

Les services sont implémentés avec le framework [Express](https://expressjs.com).

Le _middleware_ [cors](https://www.npmjs.com/package/cors) est utilisé pour gérer le [CORS](https://developer.mozilla.org/fr/docs/Web/HTTP/CORS).

Les réservations sont identifiées de manière unique par un **uuid**, généré avec [le plugin npm du même nom](https://www.npmjs.com/package/uuid).

## Développement 

Utiliser la commande `npm run dev` pour lancer le projet.

```
$ npm run dev
...
Bound to tcp port 3000
Here we go !
```

## Packaging

To be done ^^