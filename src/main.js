import './style.css';

// Infolettre — démo
document.querySelector('.news-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  alert('Merci ! Vous êtes maintenant abonnée à l\'infolettre du Choix de Sophie.');
});
