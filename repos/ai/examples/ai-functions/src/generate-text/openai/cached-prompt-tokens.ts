import { openai, type OpenAILanguageModelChatOptions } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { setTimeout } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { run } from '../../lib/run';

const longPrompt = `
Arms and the man I sing, who first made way,
Predestined exile, from the Trojan shore
To Italy, the blest Lavinian strand.
Smitten of storms he was on land and sea
By violence of Heaven, to satisfy 5
Stern Juno’s sleepless wrath; and much in war
He suffered, seeking at the last to found
The city, and bring o’er his fathers’ gods
To safe abode in Latium; whence arose
The Latin race, old Alba’s reverend lords, 10
And from her hills wide-walled, imperial Rome.

O Muse, the causes tell! What sacrilege,
Or vengeful sorrow, moved the heavenly Queen
To thrust on dangers dark and endless toil
A man whose largest honor in men’s eyes 15
Was serving Heaven? Can gods such anger feel?

In ages gones an ancient city stood—
Carthage, a Tyrian seat, which from afar
Made front on Italy and on the mouths
Of Tiber’s stream; its wealth and revenues 20
Were vast, and ruthless was its quest of war.
’T is said that Juno, of all lands she loved,
Most cherished this,—not Samos’ self so dear.
Here were her arms, her chariot; even then
A throne of power o’er nations near and far, 25
If Fate opposed not, ’t was her darling hope
To ’stablish here; but anxiously she heard
That of the Trojan blood there was a breed
Then rising, which upon the destined day
Should utterly o’erwhelm her Tyrian towers; 30
A people of wide sway and conquest proud
Should compass Libya’s doom;—such was the web
The Fatal Sisters spun.
Such was the fear
Of Saturn’s daughter, who remembered well
What long and unavailing strife she waged 35
For her loved Greeks at Troy. Nor did she fail
To meditate th’ occasions of her rage,
And cherish deep within her bosom proud
Its griefs and wrongs: the choice by Paris made;
Her scorned and slighted beauty; a whole race 40
Rebellious to her godhead; and Jove’s smile
That beamed on eagle-ravished Ganymede.
With all these thoughts infuriate, her power
Pursued with tempests o’er the boundless main
The Trojans, though by Grecian victor spared 45
And fierce Achilles; so she thrust them far
From Latium; and they drifted, Heaven-impelled,
Year after year, o’er many an unknown sea—
O labor vast, to found the Roman line!
Below th’ horizon the Sicilian isle 50
Just sank from view, as for the open sea
With heart of hope they said, and every ship
Clove with its brazen beak the salt, white waves.
But Juno of her everlasting wound
Knew no surcease, but from her heart of pain 55
Thus darkly mused: “Must I, defeated, fail
“Of what I will, nor turn the Teucrian King
“From Italy away? Can Fate oppose?
“Had Pallas power to lay waste in flame
“The Argive fleet and sink its mariners, 60
“Revenging but the sacrilege obscene
“By Ajax wrought, Oïleus’ desperate son?
“She, from the clouds, herself Jove’s lightning threw,
“Scattered the ships, and ploughed the sea with storms.
“Her foe, from his pierced breast out-breathing fire, 65
“In whirlwind on a deadly rock she flung.
“But I, who move among the gods a queen,
“Jove’s sister and his spouse, with one weak tribe
“Make war so long! Who now on Juno calls?
“What suppliant gifts henceforth her altars crown?” 70

So, in her fevered heart complaining still,
Unto the storm-cloud land the goddess came,
A region with wild whirlwinds in its womb,
Æolia named, where royal Æolus
In a high-vaulted cavern keeps control 75
O’er warring winds and loud concoùrse of storms.
There closely pent in chains and bastions strong,
They, scornful, make the vacant mountain roar,
Chafing against their bonds. But from a throne
Of lofty crag, their king with sceptred hand 80
Allays their fury and their rage confines.
Did he not so, our ocean, earth, and sky
Were whirled before them through the vast inane.
But over-ruling Jove, of this in fear,
Hid them in dungeon dark: then o’er them piled 85
Huge mountains, and ordained a lawful king
To hold them in firm sway, or know what time,
With Jove’s consent, to loose them o’er the world.

To him proud Juno thus made lowly plea:
“Thou in whose hands the Father of all gods 90
“And Sovereign of mankind confides the power
“To calm the waters or with winds upturn,
“Great Æolus! a race with me at war
“Now sails the Tuscan main towards Italy,
“Bringing their Ilium and its vanquished powers. 95
“Uprouse thy gales! Strike that proud navy down!
“Hurl far and wide, and strew the waves with dead!
“Twice seven nymphs are mine, of rarest mould,
“Of whom Deïopea, the most fair,
“I give thee in true wedlock for thine own, 100
“To mate thy noble worth; she at thy side
“Shall pass long, happy years, and fruitful bring
“Her beauteous offspring unto thee their sire.”
Then Æolus: “’T is thy sole task, O Queen
“To weigh thy wish and will. My fealty 105
“Thy high behest obeys. This humble throne
“Is of thy gift. Thy smiles for me obtain
“Authority from Jove. Thy grace concedes
“My station at your bright Olympian board,
“And gives me lordship of the darkening storm.” 110
Replying thus, he smote with spear reversed
The hollow mountain’s wall; then rush the winds
Through that wide breach in long, embattled line,
And sweep tumultuous from land to land:
With brooding pinions o’er the waters spread 115
East wind and south, and boisterous Afric gale
Upturn the sea; vast billows shoreward roll;
The shout of mariners, the creak of cordage,
Follow the shock; low-hanging clouds conceal
From Trojan eyes all sight of heaven and day; 120
Night o’er the ocean broods; from sky to sky
The thunder roll, the ceaseless lightnings glare;
And all things mean swift death for mortal man.
`;

const runCompletion = async () =>
  await generateText({
    model: openai('gpt-4o-mini'),
    messages: [
      {
        role: 'user',
        content: `What book is the following text from?: <text>${longPrompt}</text>`,
      },
    ],
    providerOptions: {
      openai: {
        maxCompletionTokens: 100,
      } satisfies OpenAILanguageModelChatOptions,
    },
  });

run(async () => {
  let start = performance.now();
  const { text, usage, providerMetadata } = await runCompletion();
  let end = performance.now();

  console.log(
    `PLEASE NOTE caching behavior is transparent and difficult to test.
    If you don't get a cache hit the first time, try several additional times.`,
  );

  console.log(`First pass text:`, text);
  console.log(`First pass usage:`, usage);
  console.log(`First pass provider metadata:`, providerMetadata);
  console.log(`First pass time: ${Math.floor(end - start)} ms`);

  console.log();

  await setTimeout(1000); // wait for it to be cached?g

  start = performance.now();
  const {
    text: text2,
    usage: usage2,
    providerMetadata: providerMetadata2,
  } = await runCompletion();
  end = performance.now();

  console.log(`Second pass text:`, text2);
  console.log(`Second pass usage:`, usage2);
  console.log(`Second pass provider metadata:`, providerMetadata2);
  console.log(`First pass time: ${Math.floor(end - start)} ms`);
});
