class PerspectiveAudio {
  public enabled: boolean = false;

  updateResonance(_accuracy0to1: number) {}
  stopResonance() {}
  playSnapSound() {}
  playVictoryFanfare() {}
  playScrambleSound() {}
}

export const puzzleAudio = new PerspectiveAudio();

