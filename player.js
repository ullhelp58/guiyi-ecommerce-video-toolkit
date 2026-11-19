const reference = document.getElementById('reference');
const result = document.getElementById('result');
const videos = [reference, result];
const playButton = document.getElementById('play');
const restartButton = document.getElementById('restart');
const seek = document.getElementById('seek');
const time = document.getElementById('time');
const status = document.getElementById('status');
const sound = document.getElementById('sound');
let endTime = 30.07;
let master = reference;
let follower = master === reference ? result : reference;
let wanted = false;
let buffering = false;
let starting = false;
let generation = 0;
let animationId = 0;
let resumeAfterSeek = false;

function showStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}

function showTime() {
  const seconds = Math.min(endTime, master.currentTime);
  seek.value = String(seconds);
  time.textContent = `${seconds.toFixed(2)} / ${endTime.toFixed(2)} 秒`;
}

function pausePlayers() {
  videos.forEach(video => video.pause());
  cancelAnimationFrame(animationId);
}

function stop() {
  generation += 1;
  wanted = false;
  buffering = false;
  starting = false;
  pausePlayers();
  playButton.textContent = '▶ 同步播放';
}

function setTime(seconds) {
  const target = Math.max(0, Math.min(seconds, endTime));
  videos.forEach(video => { video.currentTime = Math.min(target,video.duration); });
  showTime();
}

function tick() {
  if (!wanted || buffering) return;
  if (master.ended || master.currentTime >= endTime) {
    stop();
    setTime(endTime);
    showStatus('整片对照已播放完。可点击“从头同步播放”再看一遍。');
    return;
  }
  if (!master.seeking && !follower.seeking && master.currentTime < follower.duration && Math.abs(master.currentTime - follower.currentTime) > 0.07) {
    follower.currentTime = master.currentTime;
  }
  showTime();
  animationId = requestAnimationFrame(tick);
}

async function start() {
  if (starting || !wanted) return;
  const active = videos.filter(video => video === master || master.currentTime < video.duration - 0.015);
  if (active.some(video => video.readyState < 2 || video.seeking)) {
    buffering = true;
    showStatus('正在对齐并缓冲两侧画面…');
    return;
  }
  const request = ++generation;
  starting = true;
  buffering = false;
  try {
    await Promise.all(active.map(video => video.play()));
    if (request !== generation || !wanted) {
      if (!wanted) pausePlayers();
      return;
    }
    starting = false;
    playButton.textContent = 'Ⅱ 同步暂停';
    showStatus('正在同步播放整片。');
    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(tick);
  } catch (error) {
    if (request !== generation) return;
    stop();
    showStatus('播放未能开始，请再次点击同步播放。若仍失败，请换用支持 MP4 的桌面浏览器。', true);
  }
}

function ready() {
  if (!videos.every(video => Number.isFinite(video.duration))) return;
  endTime = Math.max(...videos.map(video => video.duration));
  seek.max = String(endTime);
  const firstReady = playButton.disabled;
  playButton.disabled = false;
  restartButton.disabled = false;
  if (firstReady) {
    playButton.textContent = '▶ 同步播放';
    showStatus('');
  }
  if (wanted && buffering && videos.every(video => video.ended || (video.readyState >= 2 && !video.seeking))) start();
}

playButton.addEventListener('click', () => {
  if (wanted) {
    stop();
    showStatus('两侧已暂停。');
  } else {
    if (master.currentTime >= endTime - 0.03) setTime(0);
    wanted = true;
    start();
  }
});

restartButton.addEventListener('click', () => {
  stop();
  setTime(0);
  wanted = true;
  start();
});

seek.addEventListener('input', () => {
  resumeAfterSeek = resumeAfterSeek || wanted;
  stop();
  setTime(Number(seek.value));
  showStatus('两侧已定位到同一时间。');
});
seek.addEventListener('change', () => {
  wanted = resumeAfterSeek && Number(seek.value) < endTime;
  resumeAfterSeek = false;
  if (wanted) start();
});

sound.addEventListener('change', () => {
  reference.muted = sound.value !== 'reference';
  result.muted = sound.value !== 'result';
});

videos.forEach(video => {
  video.addEventListener('loadedmetadata', ready);
  video.addEventListener('canplay', ready);
  video.addEventListener('seeked', ready);
  video.addEventListener('waiting', () => {
    if (!wanted || video.ended || video.currentTime >= video.duration - 0.015) return;
    generation += 1;
    starting = false;
    buffering = true;
    pausePlayers();
    showStatus('正在等待两侧缓冲，画面会一起继续。');
  });
  video.addEventListener('error', () => {
    stop();
    showStatus('有一段视频加载失败。请刷新页面或使用支持 MP4 的浏览器。', true);
  });
});
window.addEventListener('pagehide', stop);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && wanted) {
    stop();
    showStatus('切换页面时已同时暂停，回来后可继续。');
  }
});
ready();
