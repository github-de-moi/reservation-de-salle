
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

Utiliser la commande `npm start` pour lancer le projet.

```
$ npm start
...
Bound to tcp port 3000
Here we go !
```

(en fait, en lançant cette commande, 3 process son créés : npm, sh -c ts-node ./src/server.ts et node /usr/bin/ts-node ./src/server.ts ; seule la denière commande est vraiment pertinente ;-))

## Packaging

La génération d'un bundle de prod se fait en deux temps :
* compilation ts -> js (compilation en es6 compatible avec node)
* création d'un bundle mono fichier

$ tsc && ./node_modules/webpack/bin/webpack.js

La commande a été aliasée dans `package.json` : `npm run build`.
Le bundle définitif est disponible dans le fichier `./dist/bundle.js`.

Pour lancer le projet, utiliser node ou forever ;-)
```
$ forever ./dist/bundle.js
```

## TODO

Reste à faire :
- revoir la déclaration des endpoints (utiliser le router ?)
