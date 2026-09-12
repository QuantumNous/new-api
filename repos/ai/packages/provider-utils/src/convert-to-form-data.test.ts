import { describe, it, expect } from 'vitest';
import { convertToFormData } from './convert-to-form-data';

describe('convertToFormData()', () => {
  describe('basic values', () => {
    it('should add string values to form data', () => {
      const formData = convertToFormData({
        model: 'gpt-image-1',
        prompt: 'A cute cat',
      });

      expect(formData.get('model')).toBe('gpt-image-1');
      expect(formData.get('prompt')).toBe('A cute cat');
    });

    it('should add number values as strings', () => {
      const formData = convertToFormData({
        n: 2,
        seed: 42,
      });

      expect(formData.get('n')).toBe('2');
      expect(formData.get('seed')).toBe('42');
    });

    it('should add Blob values to form data', () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      const formData = convertToFormData({
        image: blob,
      });

      expect(formData.get('image')).toBeInstanceOf(Blob);
    });
  });

  describe('null and undefined values', () => {
    it('should skip null values', () => {
      const formData = convertToFormData({
        model: 'gpt-image-1',
        mask: null,
      });

      expect(formData.get('model')).toBe('gpt-image-1');
      expect(formData.has('mask')).toBe(false);
    });

    it('should skip undefined values', () => {
      const formData = convertToFormData({
        model: 'gpt-image-1',
        size: undefined,
      });

      expect(formData.get('model')).toBe('gpt-image-1');
      expect(formData.has('size')).toBe(false);
    });
  });

  describe('array values', () => {
    it('should add single-element arrays as single value without [] suffix', () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      const formData = convertToFormData({
        image: [blob],
      });

      expect(formData.get('image')).toBeInstanceOf(Blob);
      expect(formData.has('image[]')).toBe(false);
    });

    it('should add multi-element arrays with [] suffix', () => {
      const blob1 = new Blob(['test1'], { type: 'image/png' });
      const blob2 = new Blob(['test2'], { type: 'image/jpeg' });
      const formData = convertToFormData({
        image: [blob1, blob2],
      });

      expect(formData.has('image')).toBe(false);
      const images = formData.getAll('image[]');
      expect(images).toHaveLength(2);
      expect(images[0]).toBeInstanceOf(Blob);
      expect(images[1]).toBeInstanceOf(Blob);
    });

    it('should add multi-element arrays without [] suffix when useArrayBrackets is false', () => {
      const blob1 = new Blob(['test1'], { type: 'image/png' });
      const blob2 = new Blob(['test2'], { type: 'image/jpeg' });
      const formData = convertToFormData(
        {
          image: [blob1, blob2],
        },
        { useArrayBrackets: false },
      );

      expect(formData.has('image[]')).toBe(false);
      const images = formData.getAll('image');
      expect(images).toHaveLength(2);
      expect(images[0]).toBeInstanceOf(Blob);
      expect(images[1]).toBeInstanceOf(Blob);
    });

    it('should handle empty arrays by not adding any values', () => {
      const formData = convertToFormData({
        model: 'test',
        images: [],
      });

      expect(formData.get('model')).toBe('test');
      expect(formData.has('images')).toBe(false);
      expect(formData.has('images[]')).toBe(false);
    });

    it('should add string arrays with [] suffix', () => {
      const formData = convertToFormData({
        tags: ['cat', 'cute', 'animal'],
      });

      const tags = formData.getAll('tags[]');
      expect(tags).toHaveLength(3);
      expect(tags).toEqual(['cat', 'cute', 'animal']);
    });
  });

  describe('type validation', () => {
    it('should accept typed input objects', () => {
      type ImageInput = {
        model: string;
        prompt: string;
        n: number;
        size: `${number}x${number}` | undefined;
      };

      const formData = convertToFormData<ImageInput>({
        model: 'dall-e-3',
        prompt: 'A sunset',
        n: 1,
        size: '1024x1024',
      });

      expect(formData.get('model')).toBe('dall-e-3');
      expect(formData.get('prompt')).toBe('A sunset');
      expect(formData.get('n')).toBe('1');
      expect(formData.get('size')).toBe('1024x1024');
    });
  });

  describe('mixed values', () => {
    it('should handle a complex input with various types', () => {
      const blob = new Blob(['image data'], { type: 'image/png' });
      const formData = convertToFormData({
        model: 'gpt-image-1',
        prompt: 'Edit this image',
        image: [blob],
        mask: null,
        n: 1,
        size: '1024x1024',
        quality: 'high',
      });

      expect(formData.get('model')).toBe('gpt-image-1');
      expect(formData.get('prompt')).toBe('Edit this image');
      expect(formData.get('image')).toBeInstanceOf(Blob);
      expect(formData.has('mask')).toBe(false);
      expect(formData.get('n')).toBe('1');
      expect(formData.get('size')).toBe('1024x1024');
      expect(formData.get('quality')).toBe('high');
    });
  });
});
