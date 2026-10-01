import type { FactionId, Stance } from '../core/types';

/** Original fictional leaders. They are not likenesses of any real person. */
export interface Leader {
  name: string;
  title: string;
  /** One line for the profile and the faction picker. */
  line: string;
  greetings: Record<Stance, string>;
}

export const LEADERS: Record<FactionId, Leader> = {
  helm: {
    name: 'Captain Nesta Quill',
    title: 'Bearer of the Launch Order',
    line: 'She can recite the launch order, and she still does not know why it was given.',
    greetings: {
      war: 'You stand outside the launch order. Correct that, or be corrected.',
      peace: 'Peace is a heading we can both hold. Do not drift.',
      nap: 'A pact is a written order. I will keep my line if you keep yours.',
      alliance: 'Stand on the bridge with me. We govern this world before we settle it.',
    },
  },
  verdantia: {
    name: 'Grower Pellin Moss',
    title: 'Holder of the Atmosphere Recipe',
    line: 'The recipe for a breathable sky is in his hands. What happened to Earth is a page he does not need.',
    greetings: {
      war: 'War salts the soil. I will still defend every living plot.',
      peace: 'Leave the gardens standing and we can trade what grows.',
      nap: 'A pact gives the canopy time. I will not raise a hand while it holds.',
      alliance: 'Grow with us. Proxima is raw material, and it wants to be green.',
    },
  },
  genesis: {
    name: 'Archivist Juniper Vale',
    title: 'Warden of the Unfinished Message',
    line: 'She keeps Earth\'s last DNA archive, and a message whose last sentence was never written.',
    greetings: {
      war: 'A war burns records. I will not let the last archive burn with them.',
      peace: 'Peace keeps the vault closed to fire. That is enough, for now.',
      nap: 'Sign the pact. Life we have saved should not be spent on a border.',
      alliance: 'Restore life with me. That is the only victory I count.',
    },
  },
  ironclad: {
    name: 'Major Calder Venn',
    title: 'Officer Without a Report',
    line: 'He woke with a protocol still running and no officer left to receive it.',
    greetings: {
      war: 'Protocol is simple. You are in the way. Move, or be moved.',
      peace: 'Peace is a pause, not a friendship. Stay out of my redoubts.',
      nap: 'I will honor the line on the map. Cross it and the protocol resumes.',
      alliance: 'Fight beside Ironclad and keep up. I still report to no one but the living.',
    },
  },
  mnemosyne: {
    name: 'Listener Orla Vesper',
    title: 'Keeper of the Unanswered Calls',
    line: 'Every distress call Earth sent before launch is still in her array, and she plays them back.',
    greetings: {
      war: 'Even a war is a signal. I will answer it if I must.',
      peace: 'Peace leaves the channel open. I am still listening for Earth.',
      nap: 'A pact is a quiet frequency. Stay on it and I will trade what I hear.',
      alliance: 'Share the continent with me. Somewhere in the static, someone else is still calling.',
    },
  },
  clio: {
    name: 'Physician Wren Solace',
    title: 'The Mourner Who Edits',
    line: 'One of them mourns what the crew lost. The other edits the memory until morale holds.',
    greetings: {
      war: 'I can soften a memory. I cannot soften a war you insist on fighting.',
      peace: 'Peace lets the ward stay quiet. I will keep the history kind if you do.',
      nap: 'A pact is a mercy I can write down. One of me mourns the rest.',
      alliance: 'Stay. I will remember us kindly, and edit only what would break us.',
    },
  },
};

export function leaderGreeting(id: FactionId, stance: Stance): string {
  return LEADERS[id].greetings[stance];
}
