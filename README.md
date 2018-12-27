
# Réservation de salle

Mini projet angular qui permet de gérer un planning de réservation de salle. La version actuelle ne gère qu'une salle.

L'interface utilisateur est développée en Angular 7 avec bootstrap. Les réservations sont gérées via une api rest implémentée en node.js + express. Les données sont stockées en mémoires, avec possibilité de les sauvegarder en fichier.

## TODO

- laisser l'utilisateur choisir la couleur de ses réservations (préf à conserver dans le backend)
- utiliser le json feed comme source (https://fullcalendar.io/docs/events-json-feed) ?
- lors d'une sauvegarde, purger les données trop vieilles
- gérer la répétition

- ~~griser les evènements passés et empêcher leur modif/suppression~~
- ~~pouvoir déplacer une réservation (en édition et en drag'n'drop)~~
