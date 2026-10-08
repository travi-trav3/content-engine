/**
 * instance.test.js
 *
 * Builds a client repository from the core and checks what it holds: the
 * engine, the tests and CI, the brand workspace, the workflows set to that
 * workspace, the client's AGENTS.md, and nothing that must not ship. Runs
 * the gate regression suite and the preflight tests inside the built
 * repository. Then an update: the core's files are replaced, the client's
 * workspace is not touched.
 *
 *   node test/instance.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { makeInstance } = require('../scripts/make-instance');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'output', 'instance', 'clubpilot-content');
let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
};
const exists = (p) => fs.existsSync(path.join(OUT, p));
const read = (p) => fs.readFileSync(path.join(OUT, p), 'utf8');
const count = (dir) => fs.readdirSync(dir).length;

console.log('== a new instance ==');
fs.rmSync(path.dirname(OUT), { recursive: true, force: true });
const r = makeInstance({ brand: 'clubpilot', out: OUT });
check('the engine, layouts, tests, package files and CI are there', ['engine/generate/batch.js', 'layouts/type-card/index.js', 'test/gates-regression.js', 'package.json', 'package-lock.json', '.github/workflows/ci.yml'].every(exists));
check('so is the whole brand workspace', exists('brands/clubpilot/config.json') && exists('brands/clubpilot/brand/BRAND.md')
  && count(path.join(OUT, 'brands/clubpilot/photos')) === count(path.join(ROOT, 'brands/clubpilot/photos')) && exists('brands/clubpilot/briefs/2026-10-october-content-map.docx'));
check('nothing that must not ship: internal/, the packager, the template folder, outputs',
  !exists('internal') && !exists('scripts') && !exists('instance') && !exists('test/output') && !exists('node_modules'));
const pkg = JSON.parse(read('package.json'));
check('npm test in the instance runs every suite but this one, which needs the packager',
  !exists('test/instance.test.js') && !pkg.scripts['test:instance'] && !pkg.scripts.test.includes('instance')
  && pkg.scripts.test.split(' && ').length === JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts.test.split(' && ').length - 1
  && pkg.scripts.test.split(' && ').every((s) => exists(s.replace(/^node /, ''))), pkg.scripts.test);
const wfs = ['brief.yml', 'drafts.yml', 'founder.yml', 'photos.yml', 'routine.yml', 'scout.yml', 'sync.yml'];
check('the seven instance workflows are installed beside CI', wfs.every((f) => exists(`.github/workflows/${f}`)) && r.workflows.length === 7 && !exists('.github/workflows/batch.yml'));
check('no workflow asks for an API key: writing runs on the ChatGPT subscription',
  wfs.every((f) => !read(`.github/workflows/${f}`).includes('OPENAI_API_KEY')) && /CODEX_AUTH_KEY/.test(read('.github/workflows/routine.yml')));
check('each is set to the brand workspace, with no placeholder left',
  wfs.every((f) => /\nenv:\n {2}CE_WORKSPACE: brands\/clubpilot\n/.test(read(`.github/workflows/${f}`)) && !read(`.github/workflows/${f}`).includes('__WS__')));
check('the brief and founder workflows fire on the workspace\'s own folders', /- 'brands\/clubpilot\/briefs\/\*\*'/.test(read('.github/workflows/brief.yml'))
  && /- 'brands\/clubpilot\/sources\/\*\*'/.test(read('.github/workflows/founder.yml')));
check('commits stage the workspace\'s folders', /git add "\$CE_WORKSPACE\/\$d"/.test(read('.github/workflows/sync.yml')));
const agents = read('AGENTS.md');
check('AGENTS.md opens with the instance: where things are and what the reviewer asks for', agents.startsWith('# Club Pilot content engine')
  && /CE_WORKSPACE=brands\/clubpilot/.test(agents) && /\| New photos \|/.test(agents) && /brands\/clubpilot\/NOTES\.md/.test(agents));
check('and keeps every core rule', /Never loosen a gate to let a post through/.test(agents) && /The reviewer's words are theirs/.test(agents));
check('but not what is about the core itself', !/core-only|make-instance|Applied Intelligence planning material/.test(agents)
  && /A client instance keeps this layout/.test(agents) && /## Known gaps\n/.test(agents), agents.match(/.*(core-only|make-instance).*/)?.[0]);
check('the setup guide is docs/INSTANCE.md, and there is a README for the client', exists('docs/INSTANCE.md') && /Running an instance/.test(read('docs/INSTANCE.md')) && /drafts for review/.test(read('README.md')));
let refused = null;
try { makeInstance({ brand: 'clubpilot', out: OUT }); } catch (e) { refused = e.message; }
check('a second create into the same folder is refused', /not empty; use --update/.test(refused || ''), refused || 'accepted');

console.log('== the tests run inside the instance ==');
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(OUT, 'node_modules'), 'dir');
for (const t of ['test/gates-regression.js', 'test/doctor.test.js']) {
  let ok = true;
  let tail = '';
  try {
    tail = execFileSync(process.execPath, [t], { cwd: OUT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').pop();
  } catch (e) {
    ok = false;
    tail = String(e.stdout || e.message).trim().split('\n').slice(-3).join(' | ');
  }
  check(`${t} passes in the instance`, ok && /ALL (CHECKS PASS|EXPECTATIONS HOLD)/.test(tail), tail);
}

console.log('== an update ==');
const brandFile = path.join(OUT, 'brands/clubpilot/brand/BRAND.md');
fs.appendFileSync(brandFile, '\n- A rule the client added.\n');
fs.writeFileSync(path.join(OUT, 'brands/clubpilot/NOTES.md'), 'Ours.\n');
fs.writeFileSync(path.join(OUT, 'engine/stale.js'), '// removed upstream\n');
fs.writeFileSync(path.join(OUT, 'README.md'), '# Our README\n');
makeInstance({ brand: 'clubpilot', out: OUT, update: true });
check('the client\'s brand edits and notes survive', /A rule the client added/.test(fs.readFileSync(brandFile, 'utf8')) && read('brands/clubpilot/NOTES.md') === 'Ours.\n');
check('the core is replaced, not merged: a file removed upstream is gone', !exists('engine/stale.js') && exists('engine/generate/batch.js'));
check('the client\'s README is kept', read('README.md') === '# Our README\n');
let notInstance = null;
try { makeInstance({ brand: 'clubpilot', out: path.join(path.dirname(OUT), 'empty'), update: true }); } catch (e) { notInstance = e.message; }
check('an update refuses a folder that is not an instance', /is not an instance/.test(notInstance || ''), notInstance || 'accepted');

console.log(failures ? `\ninstance: ${failures} CHECK(S) FAILED` : '\ninstance: ALL CHECKS PASS');
process.exit(failures ? 1 : 0);
