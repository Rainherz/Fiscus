import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { majes } from '@/test/fixtures';

import { ShareCardContainer } from './ShareCardContainer';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));

const capture = jest.mocked(captureRef);
const isAvailable = jest.mocked(Sharing.isAvailableAsync);
const shareAsync = jest.mocked(Sharing.shareAsync);

async function openPreview() {
  const onClose = jest.fn();
  await render(<ShareCardContainer investment={majes} referenceMonth={null} onClose={onClose} />);
  await fireEvent(screen.getByTestId('share-card', { includeHiddenElements: true }), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 1080, height: 1350 } },
  });
  return onClose;
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('ShareCardContainer', () => {
  it('previews the generated image before sharing', async () => {
    capture.mockResolvedValue('/tmp/card.png');
    await openPreview();
    const image = await screen.findByLabelText(/^Vista previa de la imagen: FISCUS, AREQUIPA\. Majes Siguas II etapa/);
    expect(image).toHaveProp('source', { uri: '/tmp/card.png' });
    expect(screen.getByRole('button', { name: 'Compartir' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeOnTheScreen();
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it('shares the image and closes', async () => {
    capture.mockResolvedValue('/tmp/card.png');
    isAvailable.mockResolvedValue(true);
    const onClose = await openPreview();
    await fireEvent.press(await screen.findByRole('button', { name: 'Compartir' }));
    expect(shareAsync).toHaveBeenCalledWith('file:///tmp/card.png', expect.anything());
    expect(onClose).toHaveBeenCalled();
  });

  it('explains when the device cannot share images', async () => {
    capture.mockResolvedValue('/tmp/card.png');
    isAvailable.mockResolvedValue(false);
    const onClose = await openPreview();
    await fireEvent.press(await screen.findByRole('button', { name: 'Compartir' }));
    expect(await screen.findByText('Tu dispositivo no permite compartir imágenes.')).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('reports when the image cannot be generated', async () => {
    capture.mockRejectedValue(new Error('boom'));
    await openPreview();
    expect(await screen.findByText('No se pudo generar la imagen.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Compartir' })).toBeNull();
  });

  it('closes on Cancelar', async () => {
    capture.mockResolvedValue('/tmp/card.png');
    const onClose = await openPreview();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
