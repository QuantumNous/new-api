import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities } from '../../../src/IcuTransUtils';

describe('htmlEntityDecoder', () => {
  describe('basic entities', () => {
    it('should decode &nbsp; to non-breaking space', () => {
      expect(decodeHtmlEntities('hello&nbsp;world')).toBe('hello\u00A0world');
    });

    it('should decode &amp; to ampersand', () => {
      expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
    });

    it('should decode &lt; to less than', () => {
      expect(decodeHtmlEntities('5 &lt; 10')).toBe('5 < 10');
    });

    it('should decode &gt; to greater than', () => {
      expect(decodeHtmlEntities('10 &gt; 5')).toBe('10 > 5');
    });

    it('should decode &quot; to double quote', () => {
      expect(decodeHtmlEntities('He said &quot;hello&quot;')).toBe('He said "hello"');
    });

    it('should decode &apos; to single quote', () => {
      expect(decodeHtmlEntities('It&apos;s working')).toBe("It's working");
    });
  });

  describe('copyright and trademark entities', () => {
    it('should decode &copy; to copyright symbol', () => {
      expect(decodeHtmlEntities('&copy; 2024')).toBe('© 2024');
    });

    it('should decode &reg; to registered trademark', () => {
      expect(decodeHtmlEntities('React&reg;')).toBe('React®');
    });

    it('should decode &trade; to trademark symbol', () => {
      expect(decodeHtmlEntities('Product&trade;')).toBe('Product™');
    });
  });

  describe('punctuation entities', () => {
    it('should decode &hellip; to ellipsis', () => {
      expect(decodeHtmlEntities('Wait&hellip;')).toBe('Wait…');
    });

    it('should decode &ndash; to en dash', () => {
      expect(decodeHtmlEntities('pages 10&ndash;20')).toBe('pages 10–20');
    });

    it('should decode &mdash; to em dash', () => {
      expect(decodeHtmlEntities('Hello&mdash;world')).toBe('Hello—world');
    });

    it('should decode &lsquo; and &rsquo; to curly single quotes', () => {
      expect(decodeHtmlEntities('&lsquo;hello&rsquo;')).toBe('\u2018hello\u2019');
    });

    it('should decode &ldquo; and &rdquo; to curly double quotes', () => {
      expect(decodeHtmlEntities('&ldquo;hello&rdquo;')).toBe('\u201Chello\u201D');
    });

    it('should decode &sbquo; to single low quote', () => {
      expect(decodeHtmlEntities('&sbquo;test')).toBe('\u201Atest');
    });

    it('should decode &bdquo; to double low quote', () => {
      expect(decodeHtmlEntities('&bdquo;test')).toBe('\u201Etest');
    });

    it('should decode &dagger; and &Dagger; to dagger symbols', () => {
      expect(decodeHtmlEntities('Note&dagger; and Note&Dagger;')).toBe('Note† and Note‡');
    });

    it('should decode &bull; to bullet', () => {
      expect(decodeHtmlEntities('&bull; Item')).toBe('• Item');
    });

    it('should decode &prime; and &Prime; to prime symbols', () => {
      expect(decodeHtmlEntities('5&prime; 10&Prime;')).toBe('5′ 10″');
    });

    it('should decode &lsaquo; and &rsaquo; to angle quotes', () => {
      expect(decodeHtmlEntities('&lsaquo;text&rsaquo;')).toBe('‹text›');
    });

    it('should decode &sect; to section sign', () => {
      expect(decodeHtmlEntities('&sect; 1')).toBe('§ 1');
    });

    it('should decode &para; to paragraph sign', () => {
      expect(decodeHtmlEntities('&para; Introduction')).toBe('¶ Introduction');
    });

    it('should decode &middot; to middle dot', () => {
      expect(decodeHtmlEntities('A &middot; B')).toBe('A · B');
    });
  });

  describe('space entities', () => {
    it('should decode &ensp; to en space', () => {
      expect(decodeHtmlEntities('A&ensp;B')).toBe('A\u2002B');
    });

    it('should decode &emsp; to em space', () => {
      expect(decodeHtmlEntities('A&emsp;B')).toBe('A\u2003B');
    });

    it('should decode &thinsp; to thin space', () => {
      expect(decodeHtmlEntities('A&thinsp;B')).toBe('A\u2009B');
    });
  });

  describe('currency entities', () => {
    it('should decode &euro; to euro symbol', () => {
      expect(decodeHtmlEntities('Price: &euro;50')).toBe('Price: €50');
    });

    it('should decode &pound; to pound symbol', () => {
      expect(decodeHtmlEntities('&pound;100')).toBe('£100');
    });

    it('should decode &yen; to yen symbol', () => {
      expect(decodeHtmlEntities('&yen;1000')).toBe('¥1000');
    });

    it('should decode &cent; to cent symbol', () => {
      expect(decodeHtmlEntities('99&cent;')).toBe('99¢');
    });

    it('should decode &curren; to currency symbol', () => {
      expect(decodeHtmlEntities('&curren;100')).toBe('¤100');
    });
  });

  describe('math symbols', () => {
    it('should decode &times; to multiplication sign', () => {
      expect(decodeHtmlEntities('5 &times; 3')).toBe('5 × 3');
    });

    it('should decode &divide; to division sign', () => {
      expect(decodeHtmlEntities('10 &divide; 2')).toBe('10 ÷ 2');
    });

    it('should decode &minus; to minus sign', () => {
      expect(decodeHtmlEntities('5 &minus; 3')).toBe('5 − 3');
    });

    it('should decode &plusmn; to plus-minus sign', () => {
      expect(decodeHtmlEntities('&plusmn;5')).toBe('±5');
    });

    it('should decode &ne; to not equal', () => {
      expect(decodeHtmlEntities('a &ne; b')).toBe('a ≠ b');
    });

    it('should decode &le; to less than or equal', () => {
      expect(decodeHtmlEntities('x &le; 10')).toBe('x ≤ 10');
    });

    it('should decode &ge; to greater than or equal', () => {
      expect(decodeHtmlEntities('x &ge; 5')).toBe('x ≥ 5');
    });

    it('should decode &asymp; to approximately equal', () => {
      expect(decodeHtmlEntities('pi &asymp; 3.14')).toBe('pi ≈ 3.14');
    });

    it('should decode &equiv; to equivalent', () => {
      expect(decodeHtmlEntities('a &equiv; b')).toBe('a ≡ b');
    });

    it('should decode &infin; to infinity', () => {
      expect(decodeHtmlEntities('lim &rarr; &infin;')).toBe('lim → ∞');
    });

    it('should decode integral and sum symbols', () => {
      expect(decodeHtmlEntities('&int; &sum; &prod;')).toBe('∫ ∑ ∏');
    });

    it('should decode &radic; to square root', () => {
      expect(decodeHtmlEntities('&radic;2')).toBe('√2');
    });

    it('should decode &part; to partial derivative', () => {
      expect(decodeHtmlEntities('&part;f')).toBe('∂f');
    });

    it('should decode &permil; to per mille', () => {
      expect(decodeHtmlEntities('5&permil;')).toBe('5‰');
    });

    it('should decode &deg; to degree symbol', () => {
      expect(decodeHtmlEntities('90&deg;')).toBe('90°');
    });

    it('should decode &micro; to micro symbol', () => {
      expect(decodeHtmlEntities('5&micro;m')).toBe('5µm');
    });
  });

  describe('arrow entities', () => {
    it('should decode basic arrows', () => {
      expect(decodeHtmlEntities('&larr; &uarr; &rarr; &darr;')).toBe('← ↑ → ↓');
    });

    it('should decode &harr; to left-right arrow', () => {
      expect(decodeHtmlEntities('A &harr; B')).toBe('A ↔ B');
    });

    it('should decode &crarr; to carriage return arrow', () => {
      expect(decodeHtmlEntities('Press &crarr;')).toBe('Press ↵');
    });

    it('should decode double arrows', () => {
      expect(decodeHtmlEntities('&lArr; &uArr; &rArr; &dArr; &hArr;')).toBe('⇐ ⇑ ⇒ ⇓ ⇔');
    });
  });

  describe('Greek letters - lowercase', () => {
    it('should decode common lowercase Greek letters', () => {
      expect(decodeHtmlEntities('&alpha; &beta; &gamma; &delta;')).toBe('α β γ δ');
    });

    it('should decode &epsilon; &zeta; &eta; &theta;', () => {
      expect(decodeHtmlEntities('&epsilon; &zeta; &eta; &theta;')).toBe('ε ζ η θ');
    });

    it('should decode &iota; &kappa; &lambda; &mu;', () => {
      expect(decodeHtmlEntities('&iota; &kappa; &lambda; &mu;')).toBe('ι κ λ μ');
    });

    it('should decode &nu; &xi; &omicron; &pi;', () => {
      expect(decodeHtmlEntities('&nu; &xi; &omicron; &pi;')).toBe('ν ξ ο π');
    });

    it('should decode &rho; &sigma; &tau; &upsilon;', () => {
      expect(decodeHtmlEntities('&rho; &sigma; &tau; &upsilon;')).toBe('ρ σ τ υ');
    });

    it('should decode &phi; &chi; &psi; &omega;', () => {
      expect(decodeHtmlEntities('&phi; &chi; &psi; &omega;')).toBe('φ χ ψ ω');
    });
  });

  describe('Greek letters - uppercase', () => {
    it('should decode common uppercase Greek letters', () => {
      expect(decodeHtmlEntities('&Alpha; &Beta; &Gamma; &Delta;')).toBe('Α Β Γ Δ');
    });

    it('should decode &Epsilon; through &Theta;', () => {
      expect(decodeHtmlEntities('&Epsilon; &Zeta; &Eta; &Theta;')).toBe('Ε Ζ Η Θ');
    });

    it('should decode &Sigma; &Phi; &Psi; &Omega;', () => {
      expect(decodeHtmlEntities('&Sigma; &Phi; &Psi; &Omega;')).toBe('Σ Φ Ψ Ω');
    });
  });

  describe('Latin extended - uppercase', () => {
    it('should decode accented A variants', () => {
      expect(decodeHtmlEntities('&Agrave; &Aacute; &Acirc; &Atilde; &Auml; &Aring;')).toBe(
        'À Á Â Ã Ä Å',
      );
    });

    it('should decode &AElig; and &Ccedil;', () => {
      expect(decodeHtmlEntities('&AElig; &Ccedil;')).toBe('Æ Ç');
    });

    it('should decode accented E variants', () => {
      expect(decodeHtmlEntities('&Egrave; &Eacute; &Ecirc; &Euml;')).toBe('È É Ê Ë');
    });

    it('should decode accented I variants', () => {
      expect(decodeHtmlEntities('&Igrave; &Iacute; &Icirc; &Iuml;')).toBe('Ì Í Î Ï');
    });

    it('should decode &ETH; and &Ntilde;', () => {
      expect(decodeHtmlEntities('&ETH; &Ntilde;')).toBe('Ð Ñ');
    });

    it('should decode accented O variants', () => {
      expect(decodeHtmlEntities('&Ograve; &Oacute; &Ocirc; &Otilde; &Ouml; &Oslash;')).toBe(
        'Ò Ó Ô Õ Ö Ø',
      );
    });

    it('should decode accented U variants', () => {
      expect(decodeHtmlEntities('&Ugrave; &Uacute; &Ucirc; &Uuml;')).toBe('Ù Ú Û Ü');
    });

    it('should decode &Yacute; and &THORN;', () => {
      expect(decodeHtmlEntities('&Yacute; &THORN;')).toBe('Ý Þ');
    });
  });

  describe('Latin extended - lowercase', () => {
    it('should decode &szlig;', () => {
      expect(decodeHtmlEntities('&szlig;')).toBe('ß');
    });

    it('should decode accented a variants', () => {
      expect(decodeHtmlEntities('&agrave; &aacute; &acirc; &atilde; &auml; &aring;')).toBe(
        'à á â ã ä å',
      );
    });

    it('should decode &aelig; and &ccedil;', () => {
      expect(decodeHtmlEntities('&aelig; &ccedil;')).toBe('æ ç');
    });

    it('should decode accented e variants', () => {
      expect(decodeHtmlEntities('&egrave; &eacute; &ecirc; &euml;')).toBe('è é ê ë');
    });

    it('should decode accented i variants', () => {
      expect(decodeHtmlEntities('&igrave; &iacute; &icirc; &iuml;')).toBe('ì í î ï');
    });

    it('should decode &eth; and &ntilde;', () => {
      expect(decodeHtmlEntities('&eth; &ntilde;')).toBe('ð ñ');
    });

    it('should decode accented o variants', () => {
      expect(decodeHtmlEntities('&ograve; &oacute; &ocirc; &otilde; &ouml; &oslash;')).toBe(
        'ò ó ô õ ö ø',
      );
    });

    it('should decode accented u variants', () => {
      expect(decodeHtmlEntities('&ugrave; &uacute; &ucirc; &uuml;')).toBe('ù ú û ü');
    });

    it('should decode &yacute;, &thorn; and &yuml;', () => {
      expect(decodeHtmlEntities('&yacute; &thorn; &yuml;')).toBe('ý þ ÿ');
    });
  });

  describe('special characters', () => {
    it('should decode &iexcl; and &iquest;', () => {
      expect(decodeHtmlEntities('&iexcl; &iquest;')).toBe('¡ ¿');
    });

    it('should decode &fnof; to function symbol', () => {
      expect(decodeHtmlEntities('f&fnof;(x)')).toBe('fƒ(x)');
    });

    it('should decode &circ; and &tilde;', () => {
      expect(decodeHtmlEntities('&circ; &tilde;')).toBe('ˆ ˜');
    });

    it('should decode &OElig; and &oelig;', () => {
      expect(decodeHtmlEntities('&OElig; &oelig;')).toBe('Œ œ');
    });

    it('should decode &Scaron;, &scaron; and &Yuml;', () => {
      expect(decodeHtmlEntities('&Scaron; &scaron; &Yuml;')).toBe('Š š Ÿ');
    });

    it('should decode ordinal indicators', () => {
      expect(decodeHtmlEntities('1&ordf; 2&ordm;')).toBe('1ª 2º');
    });

    it('should decode diacritical marks', () => {
      expect(decodeHtmlEntities('&macr; &acute; &cedil;')).toBe('¯ ´ ¸');
    });

    it('should decode superscripts', () => {
      expect(decodeHtmlEntities('x&sup1; x&sup2; x&sup3;')).toBe('x¹ x² x³');
    });

    it('should decode fractions', () => {
      expect(decodeHtmlEntities('&frac14; &frac12; &frac34;')).toBe('¼ ½ ¾');
    });
  });

  describe('card suits', () => {
    it('should decode all card suit symbols', () => {
      expect(decodeHtmlEntities('&spades; &clubs; &hearts; &diams;')).toBe('♠ ♣ ♥ ♦');
    });
  });

  describe('miscellaneous symbols', () => {
    it('should decode &loz; to lozenge', () => {
      expect(decodeHtmlEntities('&loz;')).toBe('◊');
    });

    it('should decode mathematical script letters', () => {
      expect(decodeHtmlEntities('&weierp; &image; &real; &alefsym;')).toBe('℘ ℑ ℜ ℵ');
    });

    it('should decode &oline; to overline', () => {
      expect(decodeHtmlEntities('&oline;')).toBe('‾');
    });

    it('should decode &frasl; to fraction slash', () => {
      expect(decodeHtmlEntities('1&frasl;2')).toBe('1⁄2');
    });
  });

  describe('numeric entities', () => {
    it('should decode decimal numeric entities', () => {
      expect(decodeHtmlEntities('&#65;')).toBe('A');
      expect(decodeHtmlEntities('&#169;')).toBe('©');
      expect(decodeHtmlEntities('&#8230;')).toBe('…');
    });

    it('should decode hexadecimal numeric entities', () => {
      expect(decodeHtmlEntities('&#x41;')).toBe('A');
      expect(decodeHtmlEntities('&#xA9;')).toBe('©');
      expect(decodeHtmlEntities('&#x2026;')).toBe('…');
    });

    it('should decode lowercase hex entities', () => {
      expect(decodeHtmlEntities('&#x2f;')).toBe('/');
      expect(decodeHtmlEntities('&#x3c;')).toBe('<');
    });

    it('should decode uppercase hex entities', () => {
      expect(decodeHtmlEntities('&#x2F;')).toBe('/');
      expect(decodeHtmlEntities('&#x3C;')).toBe('<');
    });
  });

  describe('combined entities', () => {
    it('should decode multiple entities in one string', () => {
      const input = 'Tom &amp; Jerry &copy; 2024 &ndash; All rights reserved &trade;';
      const expected = 'Tom & Jerry © 2024 – All rights reserved ™';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode mixed named and numeric entities', () => {
      const input = '&lt;div&gt;Hello &#8211; &#x201C;World&#x201D;&lt;/div&gt;';
      const expected = '<div>Hello – \u201CWorld\u201D</div>';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should handle entities at start, middle, and end', () => {
      const input = '&copy; Start middle&nbsp;text end&trade;';
      const expected = '© Start middle\u00A0text end™';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode consecutive entities', () => {
      const input = '&lt;&gt;&amp;&quot;&apos;';
      const expected = '<>&"\'';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });
  });

  describe('edge cases', () => {
    it('should return empty string for empty input', () => {
      expect(decodeHtmlEntities('')).toBe('');
    });

    it('should return unchanged string when no entities present', () => {
      const input = 'Hello World 123';
      expect(decodeHtmlEntities(input)).toBe(input);
    });

    it('should handle string with only entities', () => {
      expect(decodeHtmlEntities('&amp;&lt;&gt;')).toBe('&<>');
    });

    it('should not decode incomplete entities', () => {
      expect(decodeHtmlEntities('&amp test')).toBe('&amp test');
      expect(decodeHtmlEntities('&lt test')).toBe('&lt test');
    });

    it('should not decode unknown entities', () => {
      expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;');
    });

    it('should handle malformed numeric entities', () => {
      expect(decodeHtmlEntities('&#;')).toBe('&#;');
      expect(decodeHtmlEntities('&#x;')).toBe('&#x;');
    });

    it('should preserve non-entity ampersands', () => {
      expect(decodeHtmlEntities('A & B')).toBe('A & B');
      expect(decodeHtmlEntities('Tom & Jerry')).toBe('Tom & Jerry');
    });

    it('should handle entities within words', () => {
      expect(decodeHtmlEntities('It&apos;s&nbsp;working')).toBe("It's\u00A0working");
    });

    it('should handle Unicode characters mixed with entities', () => {
      expect(decodeHtmlEntities('Hello 世界 &amp; &euro;50')).toBe('Hello 世界 & €50');
    });

    it('should handle very long strings with many entities', () => {
      const input = Array(100).fill('&copy;').join(' ');
      const expected = Array(100).fill('©').join(' ');
      expect(decodeHtmlEntities(input)).toBe(expected);
    });
  });

  describe('real-world examples', () => {
    it('should decode a typical copyright notice', () => {
      const input = '&copy; 2024 Company Name&trade;. All rights reserved&reg;.';
      const expected = '© 2024 Company Name™. All rights reserved®.';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode a mathematical expression', () => {
      const input = 'E = mc&sup2;, &pi; &asymp; 3.14159';
      const expected = 'E = mc², π ≈ 3.14159';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode formatted quotes', () => {
      const input = '&ldquo;Hello, World!&rdquo; he said.';
      const expected = '\u201CHello, World!\u201D he said.';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode HTML snippet', () => {
      const input = '&lt;div class=&quot;container&quot;&gt;Content&lt;/div&gt;';
      const expected = '<div class="container">Content</div>';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode currency with symbols', () => {
      const input = 'Price: &euro;99.99 or &pound;79.99 or &yen;10,000';
      const expected = 'Price: €99.99 or £79.99 or ¥10,000';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });

    it('should decode temperature', () => {
      const input = 'Temperature: 25&deg;C &plusmn; 2&deg;';
      const expected = 'Temperature: 25°C ± 2°';
      expect(decodeHtmlEntities(input)).toBe(expected);
    });
  });
});
