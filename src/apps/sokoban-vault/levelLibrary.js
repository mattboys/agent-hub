import microbanRaw from './levelsets/Microban.xsb?raw';
import sasquatchRaw from './levelsets/Sasquatch.xsb?raw';
import sasquatch2Raw from './levelsets/Sasquatch_II.xsb?raw';
import sasquatch3Raw from './levelsets/Sasquatch_III.xsb?raw';
import sasquatch4Raw from './levelsets/Sasquatch_IV.xsb?raw';
import sasquatch5Raw from './levelsets/Sasquatch_V.xsb?raw';
import sasquatch6Raw from './levelsets/Sasquatch_VI.xsb?raw';
import sasquatch7Raw from './levelsets/Sasquatch_VII.xsb?raw';
import xSokobanRaw from './levelsets/XSokoban.xsb?raw';

const SOURCE_SETS = [
  {
    id: 'microban',
    title: 'Microban',
    author: 'David W. Skinner',
    difficulty: 'Starter',
    source: {
      label: 'sneezingtiger.com (via x-hgg-x/sokoban-go)',
      url: 'https://github.com/x-hgg-x/sokoban-go/tree/master/levels'
    },
    raw: microbanRaw
  },
  {
    id: 'sasquatch',
    title: 'Sasquatch I',
    author: 'David W. Skinner',
    difficulty: 'Intermediate',
    source: {
      label: 'sokoban-go collection',
      url: 'https://github.com/x-hgg-x/sokoban-go/tree/master/levels'
    },
    raw: sasquatchRaw
  },
  {
    id: 'sasquatch-ii',
    title: 'Sasquatch II',
    author: 'David W. Skinner',
    difficulty: 'Intermediate',
    source: {
      label: 'sokoban-go collection',
      url: 'https://github.com/x-hgg-x/sokoban-go/tree/master/levels'
    },
    raw: sasquatch2Raw
  },
  {
    id: 'sasquatch-iii',
    title: 'Sasquatch III',
    author: 'David W. Skinner',
    difficulty: 'Challenging',
    source: {
      label: 'sokoban-go collection',
      url: 'https://github.com/x-hgg-x/sokoban-go/tree/master/levels'
    },
    raw: sasquatch3Raw
  },
  {
    id: 'sasquatch-iv',
    title: 'Sasquatch IV',
    author: 'David W. Skinner',
    difficulty: 'Challenging',
    source: {
      label: 'sokoban-go collection',
      url: 'https://github.com/x-hgg-x/sokoban-go/tree/master/levels'
    },
    raw: sasquatch4Raw
  },
  {
    id: 'sasquatch-v',
    title: 'Sasquatch V',
    author: 'David W. Skinner',
    difficulty: 'Expert',
    source: {
      label: 'sokoban-go collection',
      url: 'https://github.com/x-hgg-x/sokoban-go/tree/master/levels'
    },
    raw: sasquatch5Raw
  },
  {
    id: 'sasquatch-vi',
    title: 'Sasquatch VI',
    author: 'David W. Skinner',
    difficulty: 'Expert',
    source: {
      label: 'sokoban-go collection',
      url: 'https://github.com/x-hgg-x/sokoban-go/tree/master/levels'
    },
    raw: sasquatch6Raw
  },
  {
    id: 'sasquatch-vii',
    title: 'Sasquatch VII',
    author: 'David W. Skinner',
    difficulty: 'Expert',
    source: {
      label: 'sokoban-go collection',
      url: 'https://github.com/x-hgg-x/sokoban-go/tree/master/levels'
    },
    raw: sasquatch7Raw
  },
  {
    id: 'xsokoban',
    title: 'XSokoban',
    author: 'XSokoban community',
    difficulty: 'Classic',
    source: {
      label: 'xsokoban distribution',
      url: 'https://github.com/x-hgg-x/sokoban-go/tree/master/levels'
    },
    raw: xSokobanRaw
  }
];

const levelLibrary = SOURCE_SETS.flatMap((setMeta) => parseXsbSet(setMeta));

const countsBySet = levelLibrary.reduce((acc, level) => {
  acc[level.setId] = (acc[level.setId] || 0) + 1;
  return acc;
}, {});

export const levelSets = SOURCE_SETS.map(({ raw, ...rest }) => ({
  ...rest,
  count: countsBySet[rest.id] || 0
}));

export const totalLevelCount = levelLibrary.length;

export { levelLibrary };

function parseXsbSet(meta) {
  const { raw, ...info } = meta;
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const levels = [];
  let buffer = [];
  let pendingTitle = null;

  const flush = () => {
    if (!buffer.length) {
      return;
    }
    if (!buffer.some((line) => line.trim())) {
      buffer = [];
      return;
    }
    const trimmed = trimVerticalWhitespace(buffer);
    const width = trimmed.reduce((max, line) => Math.max(max, line.length), 0);
    if (!width) {
      buffer = [];
      return;
    }
    const rows = trimmed.map((line) => line.padEnd(width, ' '));
    const levelIndex = levels.length + 1;
    const title = pendingTitle || `${info.title} ${String(levelIndex).padStart(3, '0')}`;
    pendingTitle = null;

    levels.push({
      id: `${info.id}-${String(levelIndex).padStart(3, '0')}`,
      title,
      setId: info.id,
      setTitle: info.title,
      author: info.author,
      difficulty: info.difficulty,
      source: info.source,
      rows,
      width,
      height: rows.length,
      targetCount: countTargets(rows)
    });
    buffer = [];
  };

  lines.forEach((line) => {
    if (line.startsWith(';')) {
      const label = line.replace(/^;\s*/, '');
      if (!label) {
        return;
      }
      const numberMatch = label.match(/^(\d+)/);
      if (numberMatch) {
        pendingTitle = `${info.title} ${numberMatch[1]}`;
      } else {
        pendingTitle = label;
      }
      return;
    }

    if (!line.trim()) {
      flush();
      return;
    }

    buffer.push(line);
  });

  flush();
  return levels;
}

function trimVerticalWhitespace(rows) {
  const trimmed = [...rows];
  while (trimmed.length && !trimmed[0].trim()) {
    trimmed.shift();
  }
  while (trimmed.length && !trimmed[trimmed.length - 1].trim()) {
    trimmed.pop();
  }
  return trimmed;
}

function countTargets(rows) {
  return rows.reduce(
    (total, line) => total + (line.match(/[.*+]/g)?.length || 0),
    0
  );
}
