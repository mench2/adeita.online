// Шумоподавление с использованием Web Audio API

export class NoiseSuppressionProcessor {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private dynamicsCompressor: DynamicsCompressorNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private originalStream: MediaStream | null = null;

  constructor() {}

  async processStream(inputStream: MediaStream): Promise<MediaStream> {
    if (!inputStream || inputStream.getAudioTracks().length === 0) {
      console.warn('No audio tracks to process');
      return inputStream;
    }

    try {
      // Создаем AudioContext
      this.audioContext = new AudioContext({ sampleRate: 48000 });
      this.originalStream = inputStream;

      // Создаем source node из входного потока
      this.sourceNode = this.audioContext.createMediaStreamSource(inputStream);

      // Создаем фильтр высоких частот (убирает низкочастотный шум)
      this.filterNode = this.audioContext.createBiquadFilter();
      this.filterNode.type = 'highpass';
      this.filterNode.frequency.value = 200; // Убираем частоты ниже 200Hz
      this.filterNode.Q.value = 0.7;

      // Создаем компрессор для выравнивания громкости
      this.dynamicsCompressor = this.audioContext.createDynamicsCompressor();
      this.dynamicsCompressor.threshold.value = -50;
      this.dynamicsCompressor.knee.value = 40;
      this.dynamicsCompressor.ratio.value = 12;
      this.dynamicsCompressor.attack.value = 0.003;
      this.dynamicsCompressor.release.value = 0.25;

      // Создаем gain node для контроля громкости
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.2; // Немного усиливаем сигнал

      // Создаем destination для получения обработанного потока
      this.destination = this.audioContext.createMediaStreamDestination();

      // Соединяем узлы
      this.sourceNode
        .connect(this.filterNode)
        .connect(this.dynamicsCompressor)
        .connect(this.gainNode)
        .connect(this.destination);

      console.log('🎙️ Шумоподавление активировано');
      return this.destination.stream;
    } catch (error) {
      console.error('Failed to process audio stream:', error);
      return inputStream;
    }
  }

  cleanup() {
    try {
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
      if (this.filterNode) {
        this.filterNode.disconnect();
        this.filterNode = null;
      }
      if (this.dynamicsCompressor) {
        this.dynamicsCompressor.disconnect();
        this.dynamicsCompressor = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      if (this.destination) {
        this.destination.disconnect();
        this.destination = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
        this.audioContext = null;
      }
      console.log('🎙️ Шумоподавление отключено');
    } catch (error) {
      console.warn('Error during audio processor cleanup:', error);
    }
  }

  isActive(): boolean {
    return this.audioContext !== null && this.audioContext.state === 'running';
  }
}

