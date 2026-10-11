export const playPourSound = (): void => {
  const audio = new Audio('/audio/water_pour.mp3');
  audio.currentTime = 0;

  audio.play().catch((err) => {
    console.warn('Audio playback waiting for user interaction:', err);
  });

  setTimeout(() => {
    audio.pause();
    audio.currentTime = 0;
  }, 2000);
};