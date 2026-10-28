import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { captureCard, shareCardImage } from './shareCardImage';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));

const isAvailable = jest.mocked(Sharing.isAvailableAsync);
const shareAsync = jest.mocked(Sharing.shareAsync);
const capture = jest.mocked(captureRef);

// "PNG" bytes are irrelevant here; any base64 payload works.
const DATA_URI = 'data:image/png;base64,iVBORw0KGgo=';
const TEXT = 'Majes Siguas II etapa (AREQUIPA). AUMENTO DEL COSTO: +285%.';
const PLAIN = { cui: '2088142', text: TEXT, url: null };
const LINKED = { cui: '2088142', text: TEXT, url: 'https://rainherz.github.io/Fiscus/investment/2088142' };

afterEach(() => {
  jest.clearAllMocks();
});

describe('captureCard', () => {
  it('captures a 1080x1350 PNG file on native', async () => {
    capture.mockResolvedValue('/tmp/card.png');
    const view = 42; // a native view tag
    await expect(captureCard(view, 'ios')).resolves.toBe('/tmp/card.png');
    expect(capture).toHaveBeenCalledWith(view, {
      format: 'png',
      result: 'tmpfile',
      width: 1080,
      height: 1350,
    });
  });

  it('captures a data URI on web', async () => {
    capture.mockResolvedValue(DATA_URI);
    await captureCard(42, 'web');
    expect(capture).toHaveBeenCalledWith(42, expect.objectContaining({ result: 'data-uri' }));
  });
});

describe('shareCardImage on native', () => {
  it('opens the share sheet with the PNG file', async () => {
    isAvailable.mockResolvedValue(true);
    shareAsync.mockResolvedValue(undefined);
    await expect(shareCardImage('/tmp/card.png', PLAIN, 'android')).resolves.toBe('shared');
    expect(shareAsync).toHaveBeenCalledWith('file:///tmp/card.png', {
      mimeType: 'image/png',
      UTI: 'public.png',
      dialogTitle: 'Compartir proyecto',
    });
  });

  it('keeps an existing file:// scheme', async () => {
    isAvailable.mockResolvedValue(true);
    await shareCardImage('file:///data/card.png', PLAIN, 'android');
    expect(shareAsync).toHaveBeenCalledWith('file:///data/card.png', expect.anything());
  });

  it('reports when the device cannot share', async () => {
    isAvailable.mockResolvedValue(false);
    await expect(shareCardImage('/tmp/card.png', PLAIN, 'ios')).resolves.toBe('unavailable');
    expect(shareAsync).not.toHaveBeenCalled();
  });
});

describe('shareCardImage on web', () => {
  const g = globalThis as unknown as { navigator: unknown; document: unknown };
  const originalNavigator = g.navigator;
  const originalDocument = g.document;
  let anchor: { href: string; download: string; click: jest.Mock; remove: jest.Mock };

  beforeEach(() => {
    anchor = { href: '', download: '', click: jest.fn(), remove: jest.fn() };
    g.document = {
      createElement: jest.fn(() => anchor),
      body: { appendChild: jest.fn() },
    };
  });

  afterEach(() => {
    g.navigator = originalNavigator;
    g.document = originalDocument;
  });

  it('uses the Web Share API with the PNG file when files can be shared', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    const canShare = jest.fn().mockReturnValue(true);
    g.navigator = { canShare, share };
    await expect(shareCardImage(DATA_URI, PLAIN, 'web')).resolves.toBe('shared');
    const [{ files }] = share.mock.calls[0];
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('fiscus-2088142.png');
    expect(files[0].type).toBe('image/png');
    expect(canShare).toHaveBeenCalledWith(expect.objectContaining({ files }));
    expect(anchor.click).not.toHaveBeenCalled();
  });

  it('sends the message and the project link next to the image when there is a link', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    const canShare = jest.fn().mockReturnValue(true);
    g.navigator = { canShare, share };
    await expect(shareCardImage(DATA_URI, LINKED, 'web')).resolves.toBe('shared');
    const [data] = share.mock.calls[0];
    expect(data.url).toBe(LINKED.url);
    // The URL travels in its own field; share targets append it to the text.
    expect(data.text).toBe(TEXT);
    expect(data.files[0].name).toBe('fiscus-2088142.png');
    expect(canShare).toHaveBeenCalledWith(data);
  });

  it('sends the message without a url field when there is no link', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    g.navigator = { canShare: () => true, share };
    await shareCardImage(DATA_URI, PLAIN, 'web');
    const [data] = share.mock.calls[0];
    expect(data.text).toBe(TEXT);
    expect(data).not.toHaveProperty('url');
  });

  it('shares only the image when the browser refuses files together with text', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    const canShare = jest.fn((data: { text?: string }) => data.text === undefined);
    g.navigator = { canShare, share };
    await expect(shareCardImage(DATA_URI, LINKED, 'web')).resolves.toBe('shared');
    const [data] = share.mock.calls[0];
    expect(Object.keys(data)).toEqual(['files']);
  });

  it('treats a dismissed share sheet as cancelled', async () => {
    const abort = Object.assign(new Error('dismissed'), { name: 'AbortError' });
    g.navigator = { canShare: () => true, share: jest.fn().mockRejectedValue(abort) };
    await expect(shareCardImage(DATA_URI, PLAIN, 'web')).resolves.toBe('cancelled');
    expect(anchor.click).not.toHaveBeenCalled();
  });

  it('downloads the PNG when files cannot be shared', async () => {
    g.navigator = { canShare: () => false, share: jest.fn() };
    await expect(shareCardImage(DATA_URI, PLAIN, 'web')).resolves.toBe('downloaded');
    expect(anchor.href).toBe(DATA_URI);
    expect(anchor.download).toBe('fiscus-2088142.png');
    expect(anchor.click).toHaveBeenCalled();
    expect(anchor.remove).toHaveBeenCalled();
  });

  it('downloads the PNG when the browser has no Web Share API', async () => {
    g.navigator = {};
    await expect(shareCardImage(DATA_URI, PLAIN, 'web')).resolves.toBe('downloaded');
  });

  it('downloads the PNG when sharing is refused for another reason', async () => {
    const refused = Object.assign(new Error('no activation'), { name: 'NotAllowedError' });
    g.navigator = { canShare: () => true, share: jest.fn().mockRejectedValue(refused) };
    await expect(shareCardImage(DATA_URI, PLAIN, 'web')).resolves.toBe('downloaded');
  });
});
