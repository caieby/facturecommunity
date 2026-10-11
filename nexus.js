(function () {
  const STAR_COUNT = 140;
  const SHOOTING_STAR_COUNT = 3;

  const field = document.createElement('div');
  field.className = 'nexus-starfield';

  for (let i = 0; i < STAR_COUNT; i++) {
    const star = document.createElement('span');
    star.className = 'nexus-star';
    star.style.left = `${Math.random() * 100}vw`;
    star.style.top = `${Math.random() * 100}vh`;
    star.style.animationDelay = `${Math.random() * 4}s`;
    star.style.opacity = (0.3 + Math.random() * 0.7).toFixed(2);
    const size = (Math.random() * 1.6 + 0.6).toFixed(1);
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    field.appendChild(star);
  }

  for (let i = 0; i < SHOOTING_STAR_COUNT; i++) {
    const shootingStar = document.createElement('span');
    shootingStar.className = 'nexus-shooting-star';
    shootingStar.style.top = `${Math.random() * 40}vh`;
    shootingStar.style.left = `${Math.random() * 60}vw`;
    shootingStar.style.animationDelay = `${i * 4 + Math.random() * 5}s`;
    field.appendChild(shootingStar);
  }

  document.body.prepend(field);
})();
