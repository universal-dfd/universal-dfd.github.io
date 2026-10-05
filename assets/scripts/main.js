/* ======================== Slide Control ===================== */
/* A "slide menu" is a row of .dot buttons that swap between sibling
   .slide-content blocks inside the same .container. Pass the id of each
   menu you want wired up; several may coexist on one page. */
function initializeSlideMenu(menuId) {
  var menu = document.getElementById(menuId);
  if (!menu) return;

  var container = menu.closest('.container');
  if (!container) return;

  var contents = container.getElementsByClassName("slide-content");

  menu.addEventListener("click", function(e) {
    const idx = [...this.children]
      .filter(el => el.className.indexOf('dot') > -1)
      .indexOf(e.target);

    if (idx >= 0) {
      // Remove active from all dots in this menu
      var prevDots = menu.querySelectorAll(".dot.active");
      prevDots.forEach(dot => dot.classList.remove("active"));
      e.target.classList.add("active");

      // Show the selected slide
      for (var i = 0; i < contents.length; i++) {
        contents[i].style.display = (i == idx) ? "block" : "none";
      }
    }
  });
}

// Any element with class "slide-menu" is wired up automatically; add an id
// and call initializeSlideMenu('your-id') below for menus named otherwise.
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.slide-menu[id]').forEach(function(menu) {
    initializeSlideMenu(menu.id);
  });
});

/* ======================== Video Control ===================== */
/* Each control acts on every <video class="<name>-video"> on the page and
   reports the new speed in <span id="<name>-msg">. */
function ToggleVideo(x) {
  var videos = document.getElementsByClassName(x + '-video');
  for (var i = 0; i < videos.length; i++) {
    if (videos[i].paused) {
      videos[i].play();
    } else {
      videos[i].pause();
    }
  }
}

function announceSpeed(x, videos) {
  var msg = document.getElementById(x + '-msg');
  if (!msg || !videos.length) return;

  msg.innerHTML = 'Speed: ' + '×' + videos[0].playbackRate.toFixed(2);
  msg.classList.add("fade-in-out");
  msg.style.animation = 'none';
  msg.offsetHeight; /* trigger reflow */
  msg.style.animation = null;
}

function SlowVideo(x) {
  var videos = document.getElementsByClassName(x + '-video');
  for (var i = 0; i < videos.length; i++) {
    videos[i].playbackRate = videos[i].playbackRate * 0.9;
    videos[i].play();
  }
  announceSpeed(x, videos);
}

function FastVideo(x) {
  var videos = document.getElementsByClassName(x + '-video');
  for (var i = 0; i < videos.length; i++) {
    videos[i].playbackRate = videos[i].playbackRate / 0.9;
    videos[i].play();
  }
  announceSpeed(x, videos);
}

function RestartVideo(x) {
  var videos = document.getElementsByClassName(x + '-video');
  for (var i = 0; i < videos.length; i++) {
    videos[i].pause();
    videos[i].playbackRate = 1.0;
    videos[i].currentTime = 0;
    videos[i].play();
  }
  announceSpeed(x, videos);
}

/* ======================== Slide Show Control ===================== */
/* Carousel for `.container .slider` with #prev_btn / #next_btn. The whole
   block no-ops when the page has no slider, so main.js stays safe to include
   on every page. */
document.addEventListener('DOMContentLoaded', function() {
  const slider = document.querySelector('.container .slider');
  const btnLeft = document.getElementById('prev_btn');
  const btnRight = document.getElementById('next_btn');
  if (!slider || !btnLeft || !btnRight) return;

  const SLIDE_WIDTH = 440;
  let interval;

  const setPositions = () =>
    [...slider.children].forEach((item, i) =>
      item.style.left = `${(i - 1) * SLIDE_WIDTH}px`);

  const setTransitionSpeed = (speed) =>
    [...slider.children].forEach(item =>
      item.style.transitionDuration = speed);

  const next = (isAuto = false) => {
    setTransitionSpeed(isAuto ? '1.5s' : '0.2s');
    slider.appendChild(slider.firstElementChild);
    setPositions();
  };

  const prev = () => {
    setTransitionSpeed('0.2s');
    slider.prepend(slider.lastElementChild);
    setPositions();
  };

  const startAuto = () => interval = interval || setInterval(() => next(true), 2000);
  const stopAuto = () => { clearInterval(interval); interval = null; };

  setPositions();

  btnRight.addEventListener('click', () => next(false));
  btnLeft.addEventListener('click', prev);

  // Pause the carousel while the reader is looking at it
  [slider, btnLeft, btnRight].forEach(el => {
    el.addEventListener('mouseover', stopAuto);
    el.addEventListener('mouseout', startAuto);
  });

  startAuto();
});
