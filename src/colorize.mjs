import chalk from 'chalk';

function boostChalkLevelForXtermJs() {
  if (process.env.TERM_PROGRAM === 'vscode' && chalk.level === 2) {
    chalk.level = 3;
    return true;
  }
  return false;
}

function clampChalkLevelForTmux() {
  if (process.env.TMUX && chalk.level > 2) {
    chalk.level = 2;
    return true;
  }
  return false;
}

export const CHALK_BOOSTED = boostChalkLevelForXtermJs();
export const CHALK_CLAMPED = clampChalkLevelForTmux();

export function chalkLevelLabel() {
  if (CHALK_CLAMPED) return `level ${chalk.level} (256-color, tmux clamped)`;
  if (CHALK_BOOSTED) return `level ${chalk.level} (truecolor, xterm.js boosted)`;
  return `level ${chalk.level} (${chalk.level === 3 ? 'truecolor' : chalk.level === 2 ? '256-color' : chalk.level === 1 ? '16-color' : 'no color'})`;
}

export function colorize(str, color, type = 'foreground') {
  if (!color) return str;
  if (color.startsWith('#')) {
    return type === 'foreground' ? chalk.hex(color)(str) : chalk.bgHex(color)(str);
  }
  if (color.startsWith('rgb(')) {
    const m = color.match(/rgb\(\s?(\d+),\s?(\d+),\s?(\d+)\s?\)/);
    if (!m) return str;
    return type === 'foreground' ? chalk.rgb(+m[1], +m[2], +m[3])(str) : chalk.bgRgb(+m[1], +m[2], +m[3])(str);
  }
  if (color.startsWith('ansi256(')) {
    const m = color.match(/ansi256\(\s?(\d+)\s?\)/);
    if (!m) return str;
    return type === 'foreground' ? chalk.ansi256(+m[1])(str) : chalk.bgAnsi256(+m[1])(str);
  }
  if (color.startsWith('ansi:')) {
    const name = color.substring(5);
    const fgMap = { black: chalk.black, red: chalk.red, green: chalk.green, yellow: chalk.yellow, blue: chalk.blue, magenta: chalk.magenta, cyan: chalk.cyan, white: chalk.white, blackBright: chalk.blackBright, redBright: chalk.redBright, greenBright: chalk.greenBright, yellowBright: chalk.yellowBright, blueBright: chalk.blueBright, magentaBright: chalk.magentaBright, cyanBright: chalk.cyanBright, whiteBright: chalk.whiteBright };
    const bgMap = { black: chalk.bgBlack, red: chalk.bgRed, green: chalk.bgGreen, yellow: chalk.bgYellow, blue: chalk.bgBlue, magenta: chalk.bgMagenta, cyan: chalk.bgCyan, white: chalk.bgWhite, blackBright: chalk.bgBlackBright, redBright: chalk.bgRedBright, greenBright: chalk.bgGreenBright, yellowBright: chalk.bgYellowBright, blueBright: chalk.bgBlueBright, magentaBright: chalk.bgMagentaBright, cyanBright: chalk.bgCyanBright, whiteBright: chalk.bgWhiteBright };
    const fn = type === 'foreground' ? fgMap[name] : bgMap[name];
    return fn ? fn(str) : str;
  }
  return str;
}

export const cfg = (hex, str) => colorize(str, hex, 'foreground');
export const cbg = (hex, str) => colorize(str, hex, 'background');

export { chalk };
