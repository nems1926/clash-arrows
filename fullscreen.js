// Bascule l'état plein écran via l'API q5. Pure : aucune dépendance DOM,
// reçoit l'objet q5 (`api`) qui expose fullscreen() en lecture et écriture.
export const toggleFullscreen = (api) => api.fullscreen(!api.fullscreen());
