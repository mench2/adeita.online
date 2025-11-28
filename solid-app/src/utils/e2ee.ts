// End-to-End Encryption для WebRTC медиа потоков и чата

// Генерация ключа шифрования для комнаты
export async function generateRoomKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Экспорт ключа в строку для передачи через URL
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  const exportedKeyBuffer = new Uint8Array(exported);
  const base64Key = btoa(String.fromCharCode(...exportedKeyBuffer));
  return base64Key;
}

// Импорт ключа из строки
export async function importKey(base64Key: string): Promise<CryptoKey> {
  const keyBuffer = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Шифрование текста (для чата)
export async function encryptText(text: string, key: CryptoKey): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    data
  );
  
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

// Расшифровка текста (для чата)
export async function decryptText(encryptedText: string, ivString: string, key: CryptoKey): Promise<string> {
  const encrypted = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivString), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encrypted
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// Frame Crypto для Insertable Streams (видео/аудио)
export class FrameCryptor {
  private key: CryptoKey;
  private keyMaterial: Uint8Array;
  
  constructor(key: CryptoKey) {
    this.key = key;
    this.keyMaterial = new Uint8Array(32); // Будет заполнен при первом использовании
  }
  
  async initialize() {
    const exported = await crypto.subtle.exportKey('raw', this.key);
    this.keyMaterial = new Uint8Array(exported);
  }
  
  // Шифрование фрейма
  async encryptFrame(frame: RTCEncodedVideoFrame | RTCEncodedAudioFrame): Promise<ArrayBuffer> {
    const data = new Uint8Array(frame.data);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      this.key,
      data
    );
    
    // Добавляем IV в начало зашифрованных данных
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);
    
    return result.buffer;
  }
  
  // Расшифровка фрейма
  async decryptFrame(encryptedData: ArrayBuffer): Promise<ArrayBuffer> {
    const data = new Uint8Array(encryptedData);
    
    // Извлекаем IV из начала данных
    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);
    
    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.key,
        encrypted
      );
      
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt frame:', error);
      // Возвращаем пустой буфер в случае ошибки
      return new ArrayBuffer(0);
    }
  }
}

// Применение E2EE к RTCRtpSender (исходящий поток)
export async function setupSenderTransform(sender: RTCRtpSender, cryptor: FrameCryptor) {
  if (!sender.transform) {
    console.warn('Insertable Streams API not supported for sender');
    return;
  }
  
  const senderStreams = sender.createEncodedStreams();
  const transformStream = new TransformStream({
    async transform(frame: RTCEncodedVideoFrame | RTCEncodedAudioFrame, controller) {
      try {
        const encryptedData = await cryptor.encryptFrame(frame);
        frame.data = encryptedData;
        controller.enqueue(frame);
      } catch (error) {
        console.error('Error encrypting frame:', error);
        controller.enqueue(frame);
      }
    }
  });
  
  senderStreams.readable
    .pipeThrough(transformStream)
    .pipeTo(senderStreams.writable)
    .catch(error => console.error('Sender transform error:', error));
}

// Применение E2EE к RTCRtpReceiver (входящий поток)
export async function setupReceiverTransform(receiver: RTCRtpReceiver, cryptor: FrameCryptor) {
  if (!receiver.transform) {
    console.warn('Insertable Streams API not supported for receiver');
    return;
  }
  
  const receiverStreams = receiver.createEncodedStreams();
  const transformStream = new TransformStream({
    async transform(frame: RTCEncodedVideoFrame | RTCEncodedAudioFrame, controller) {
      try {
        const decryptedData = await cryptor.decryptFrame(frame.data);
        if (decryptedData.byteLength > 0) {
          frame.data = decryptedData;
        }
        controller.enqueue(frame);
      } catch (error) {
        console.error('Error decrypting frame:', error);
        controller.enqueue(frame);
      }
    }
  });
  
  receiverStreams.readable
    .pipeThrough(transformStream)
    .pipeTo(receiverStreams.writable)
    .catch(error => console.error('Receiver transform error:', error));
}

