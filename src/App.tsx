import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, BookOpen, Brain, Check, ChevronDown, CircleHelp, Clock3, FileText, Flame, FolderOpen, GraduationCap, Layers3, LayoutDashboard, Leaf, LibraryBig, ListChecks, LoaderCircle, Menu, MessageSquareText, MoreHorizontal, Plus, Search, ShieldCheck, Sparkles, Target, Trash2, TrendingUp, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Library, Mode, StudyDeck, StudySource, View } from './types';
import { demoLibrary } from './lib/demo';
import { buildStudyContent, recordReview, stats } from './lib/study';
import { downloadBackup, loadLibrary, saveLibrary, validateBackup } from './lib/storage';
import UploadDialog from './components/UploadDialog';
import StudySession from './components/StudySession';

const modes: { id: Mode; title: string; description: string; icon: LucideIcon; tone: string; tag: string }[] = [
  { id: 'flashcards', title: 'Flip. Think. Remember.', description: 'Small cards. Big “aha” moments.', icon: Layers3, tone: 'purple', tag: 'FLASHCARDS' },
  { id: 'quiz', title: 'Put it to the test.', description: 'Find out what’s really sticking.', icon: ListChecks, tone: 'orange', tag: 'QUICK QUIZ' },
  { id: 'match', title: 'Connect the dots.', description: 'Match concepts. Make connections.', icon: Brain, tone: 'green', tag: 'MATCH IT' },
  { id: 'recall', title: 'Say it your way.', description: 'Explain it. Understand it. Own it.', icon: MessageSquareText, tone: 'blue', tag: 'WRITTEN RECALL' },
  { id: 'exam', title: 'Meet your next exam.', description: 'Practice with your past papers.', icon: GraduationCap, tone: 'pink', tag: 'PAST PAPER PRACTICE' },
];

export default function App() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [view, setView] = useState<View>('overview');
  const [upload, setUpload] = useState<'new' | 'add' | null>(null);
  const [session, setSession] = useState<{ mode: Mode; weakOnly: boolean } | null>(null);
  const [query, setQuery] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState('');
  const [storageError, setStorageError] = useState('');
  const [openSource, setOpenSource] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [sourceKinds, setSourceKinds] = useState<Record<string, StudySource['kind']>>({});
  const backupInput = useRef<HTMLInputElement>(null);
  const saveQueue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    loadLibrary().then(saved => { if (active) setLibrary(saved ? validateBackup(saved) : demoLibrary()); }).catch(() => { if (active) { setLibrary(demoLibrary()); setStorageError('Browser storage could not be read. Export a backup to keep your work.'); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!library) return;
    // Serialise writes so an earlier save can never overwrite a later answer.
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveLibrary(library)).then(() => setStorageError('')).catch(() => setStorageError('Your browser could not save this change. Export a backup before closing this page.'));
  }, [library]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''),4000); return () => clearTimeout(timer); },[toast]);
  if (!library) return <div className="loading-screen"><span className="brand-mark">q<span>•</span></span><LoaderCircle className="spin"/><p>Making a little room for learning…</p></div>;
  const deck = library.decks.find(item => item.id === library.activeId);
  const deckStats = deck ? stats(deck) : { mastery: 0, accuracy: 0, reviewed: 0, familiar: 0, weak: 0, attempts: 0, correct: 0, due: 0 };
  function updateDeck(updater: (deck: StudyDeck) => StudyDeck) {
    setLibrary(current => current ? { ...current, decks: current.decks.map(item => item.id === current.activeId ? updater(item) : item) } : current);
  }
  function navigate(next: View) { setView(next); setSession(null); setQuery(''); setOpenSource(null); setMobileMenu(false); }
  function startSession(mode: Mode, weakOnly = false) { setSession({ mode, weakOnly }); setView('study'); setMobileMenu(false); window.scrollTo({ top: 0 }); }
  function saveUploaded(title: string, sources: StudySource[]) {
    if (upload === 'add' && deck) updateDeck(current => {
      const combined = [...current.sources,...sources];
      return { ...current, title, sources: combined, ...buildStudyContent(combined) };
    });
    else {
      const created: StudyDeck = { id: crypto.randomUUID(), title, description: 'Your notes. Your next breakthrough.', createdAt: Date.now(), sources, ...buildStudyContent(sources), progress: {}, sessions: [] };
      setLibrary(current => current ? { ...current, activeId: created.id, decks: [...current.decks,created] } : current);
    }
    setUpload(null); navigate('overview'); setToast('Your study set is ready. Let’s make it stick.');
  }
  function removeSource(sourceId: string) {
    updateDeck(current => {
      const sources = current.sources.filter(source => source.id !== sourceId);
      const content = buildStudyContent(sources);
      return { ...current, sources, ...content, progress: Object.fromEntries(Object.entries(current.progress).filter(([id]) => content.cards.some(card => card.id === id))) };
    });
    setConfirmDelete(null); setOpenSource(null); setToast('Material removed from this study set.');
  }
  async function restoreBackup(file: File) {
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('The backup file limit is 50 MB.');
      const incoming = validateBackup(JSON.parse(await file.text()));
      setLibrary(current => {
        if (!current) return incoming;
        // Restore as additional copies, preserving all existing sets and their progress.
        const copies = incoming.decks.map(item => ({ ...item, id: crypto.randomUUID(), title: current.decks.some(deck => deck.title === item.title) ? `${item.title} (restored)` : item.title }));
        const activeIndex = incoming.decks.findIndex(item => item.id === incoming.activeId);
        return { ...current, decks: [...current.decks,...copies], activeId: copies[activeIndex]?.id ?? copies[0]?.id ?? current.activeId };
      });
      navigate('overview'); setToast('Backup restored. Your existing study sets were kept.');
    } catch (error) { setToast(error instanceof Error ? error.message : 'Could not restore this backup.'); }
  }
  const matchingSources = deck?.sources.filter(source => (source.name + source.blocks.map(block => block.text).join(' ')).toLocaleLowerCase().includes(query.toLocaleLowerCase())) ?? [];
  const focusCards = deck?.cards.filter(card => deck.progress[card.id] && deck.progress[card.id].streak < 2).slice(0,4) ?? [];
  const filteredCards = deck?.cards.filter(card => (card.term + card.evidence).toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0,40) ?? [];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
      <a className="brand" href="#" onClick={event => { event.preventDefault(); navigate('overview'); }} aria-label="QuizoForStudents home"><span className="brand-mark">q<span>•</span></span><span>quizo<span className="brand-subtitle">FOR STUDENTS</span></span></a>
      <button className="button new-set-button" onClick={() => { setUpload('new'); setMobileMenu(false); }}><Plus size={18}/> New study set</button>
      <span className="nav-label">YOUR WORKSPACE</span><nav aria-label="Main navigation">{([{ id: 'overview', label: 'Overview', icon: LayoutDashboard },{ id: 'materials', label: 'My materials', icon: FolderOpen },{ id: 'study', label: 'Study modes', icon: Layers3 },{ id: 'progress', label: 'My progress', icon: TrendingUp }] as const).map(item => <button className={`nav-item ${view === item.id ? 'active' : ''}`} key={item.id} onClick={() => navigate(item.id)}><item.icon size={19}/>{item.label}{item.id === 'materials' && <span className="nav-count">{deck?.sources.length ?? 0}</span>}</button>)}</nav>
      <div className="set-list-heading"><span className="nav-label">STUDY SETS</span><button className="icon-button" aria-label="Create another study set" onClick={() => setUpload('new')}><Plus size={16}/></button></div>
      <div className="set-list">{library.decks.map(item => <button className={`set-item ${item.id === library.activeId ? 'selected' : ''}`} key={item.id} onClick={() => { setLibrary({ ...library, activeId: item.id }); navigate('overview'); }}><span className={`set-dot ${item.isDemo ? 'green' : 'purple'}`}/><span>{item.title}</span>{item.isDemo && <small>DEMO</small>}</button>)}</div>
      <div className="sidebar-bottom"><div className="little-reminder"><span><Leaf size={19}/></span><h4>Progress, a little at a time.</h4><p>Ten focused minutes can be a pretty good start.</p></div><button className="nav-item" onClick={() => setHelp(true)}><CircleHelp size={19}/> How Quizo works</button><a className="github-link" href="https://github.com/pontusfroden/QuizoForStudents" target="_blank" rel="noreferrer">Made for curious minds <ArrowRight size={13}/></a></div>
    </aside>
    {mobileMenu && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMobileMenu(false)}/>}
    <div className="main-column"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileMenu(true)}><Menu size={21}/></button><span>My workspace</span><span className="breadcrumb-slash">/</span><strong>{view === 'materials' ? 'My materials' : view === 'study' ? 'Study modes' : view === 'progress' ? 'My progress' : 'Overview'}</strong></div><div className="topbar-actions"><label className="search-box"><Search size={17}/><input aria-label="Search your materials" value={query} onChange={event => { setQuery(event.target.value); if (session) setSession(null); if (view !== 'materials') setView('materials'); }} placeholder="Find a concept or file…"/><span>⌕</span></label><button className="avatar" aria-label="How your local workspace works" onClick={() => setHelp(true)}>S<span/></button></div></header>
      <main>
        {storageError && <div className="inline-error" role="alert">{storageError}<button className="text-button" onClick={() => downloadBackup(library)}>Export backup</button></div>}
        {!deck ? <div className="empty-state"><LibraryBig size={42}/><h1>A fresh start for your next test.</h1><p>Add your first study set to turn notes into practice.</p><button className="button primary" onClick={() => setUpload('new')}><Plus size={18}/> Create a study set</button></div> : session ? <StudySession key={`${deck.id}-${session.mode}-${session.weakOnly}`} deck={deck} mode={session.mode} weakOnly={session.weakOnly} onClose={() => navigate('overview')} onReview={(id,correct) => updateDeck(current => ({ ...current, progress: { ...current.progress, [id]: recordReview(current.progress[id],correct) } }))} onFinish={(mode,correct,total) => updateDeck(current => ({ ...current, sessions: [...current.sessions,{ time: Date.now(), mode, correct, total }].slice(-200) }))}/> : <>
          <div className="page-heading"><div><div className="eyebrow">{view === 'overview' ? 'A LITTLE PRACTICE. A LOT MORE CONFIDENCE.' : deck.title.toUpperCase()}</div><h1>{view === 'overview' ? 'Good things take a little practice.' : view === 'materials' ? 'Your knowledge starts here.' : view === 'study' ? 'Find your way to “I get it”.' : 'Every little step counts.'}</h1><p>{view === 'overview' ? 'Big test coming up? Let’s break it into small wins.' : view === 'materials' ? 'Your notes, slides, and past papers. All working together.' : view === 'study' ? 'Different ways to practice. The same next breakthrough.' : 'See what’s sticking and what needs another look.'}</p></div><button className="button secondary compact" onClick={() => setUpload('add')}><Plus size={17}/> Add materials</button></div>
          {deck.isDemo && <div className="demo-banner"><span><Sparkles size={15}/> You’re exploring a sample biology set.</span><button onClick={() => setUpload('new')}>Try your own notes <ArrowRight size={14}/></button></div>}
          {view === 'overview' && <>
            <section className="hero"><div className="hero-copy"><span className="hero-badge"><Sparkles size={14}/> FROM NOTES TO KNOW-HOW</span><h2>Big notes.<br/>Small steps.<span className="hero-underline"/></h2><p>Your material, turned into moments that stick.<br/>A little less overwhelm. A lot more understanding.</p><button className="button hero-button" onClick={() => startSession('quiz')}>Let’s get learning <ArrowRight size={17}/></button><span className="hero-footnote">Your next small win is one quiz away.</span></div><div className="hero-art" aria-hidden="true"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><span className="art-spark one">✦</span><span className="art-spark two">✧</span><span className="art-dot"/><div className="floating-note back-note"><span>little steps</span><div/><div/><div/></div><div className="floating-note front-note"><span className="note-label"><span/> A QUICK CHECK-IN</span><strong>What if learning<br/>felt a little lighter?</strong><div className="note-answer"><span><Check size={14}/></span> One idea at a time.</div><div className="mini-card-footer"><span>01 / ∞</span><ArrowRight size={17}/></div></div><div className="art-chip"><span><Check size={13}/></span> You’ve got this.</div></div></section>
            <div className="stats-row"><Stat icon={FileText} tone="purple" value={String(deck.sources.length)} label="Materials, connected"/><Stat icon={Layers3} tone="orange" value={String(deck.cards.length)} label="Ideas to explore"/><Stat icon={Target} tone="green" value={`${deckStats.mastery}%`} label="Concepts becoming familiar"/><Stat icon={Flame} tone="pink" value={String(deck.sessions.length)} label="Sessions under your belt"/></div>
            <div className="section-heading"><div><h2>A way to learn for every mood.</h2><p>Start small. Switch it up. Find what clicks.</p></div><button className="text-button" onClick={() => navigate('study')}>All study modes <ArrowRight size={16}/></button></div>
            <div className="mode-grid overview-modes">{modes.slice(0,4).map(mode => <ModeCard key={mode.id} mode={mode} onClick={() => startSession(mode.id)}/>)}</div>
            <div className="overview-bottom"><section className="material-preview"><div className="section-heading"><h2>Your current chapter.</h2><button className="text-button" onClick={() => navigate('materials')}>View all <ArrowRight size={15}/></button></div><div className="current-set"><span className="subject-icon"><BookOpen size={25}/></span><div><h3>{deck.title}</h3><p>{deck.description}</p><div className="set-meta"><span><FileText size={13}/>{deck.sources.length} materials</span><span><Layers3 size={13}/>{deck.cards.length} ideas</span></div></div><button className="icon-button" aria-label="View study set materials" onClick={() => navigate('materials')}><MoreHorizontal size={20}/></button></div><div className="set-progress-label"><span>{deckStats.reviewed} of {deck.cards.length} concepts explored</span><strong>{deckStats.mastery}% familiar</strong></div><div className="progress-track"><span style={{ width: `${deckStats.mastery}%` }}/></div><button className="text-button continue-button" onClick={() => startSession('flashcards')}>Pick up a little knowledge <ArrowRight size={15}/></button></section><section className="focus-panel"><span className="focus-icon"><Target size={21}/></span><h3>{deckStats.weak ? 'A second look goes a long way.' : 'Your next small win.'}</h3><p>{deckStats.weak ? `${deckStats.weak} concepts could use another visit. Let’s give them a little attention.` : 'Start a quick quiz. We’ll remember the tricky bits so you know what to practice next.'}</p><button className="text-button" onClick={() => startSession('quiz',deckStats.weak > 0)}>{deckStats.weak ? 'Review tricky concepts' : 'Try a quick quiz'}<ArrowRight size={15}/></button></section></div>
          </>}
          {view === 'study' && <><div className="mode-grid all-modes">{modes.map(mode => <ModeCard key={mode.id} mode={mode} onClick={() => startSession(mode.id)}/>)}</div><div className="study-tip"><span><Clock3 size={24}/></span><div><h3>A rhythm that works for you.</h3><p>Quiz yourself, revisit tricky concepts, and come back tomorrow. Your review queue puts missed answers and due cards first.</p></div><button className="button secondary" disabled={!deckStats.weak} onClick={() => startSession('quiz',true)}>Review {deckStats.weak} tricky concepts<ArrowRight size={16}/></button></div></>}
          {view === 'materials' && <>
            <div className="materials-toolbar"><span>{deck.sources.length} materials · {deck.sources.reduce((sum,source) => sum + source.wordCount,0).toLocaleString()} words</span><div className="button-row"><button className="text-button" onClick={() => downloadBackup(library)}><ArrowDownToLine size={15}/> Export backup</button><button className="text-button" onClick={() => backupInput.current?.click()}><ArrowUpFromLine size={15}/> Restore backup</button></div></div>
            <div className="material-list">{matchingSources.map(source => <article className="material-row" key={source.id}><span className={`file-icon ${source.kind === 'exam' ? 'orange' : source.format === 'PPTX' ? 'green' : 'purple'}`}><FileText size={23}/><small>{source.format}</small></span><div className="file-info"><h3>{source.name}</h3><p>{source.wordCount.toLocaleString()} words · {source.blocks.length} {source.format === 'PDF' ? 'pages' : source.format === 'PPTX' ? 'slides' : 'sections'}{source.warnings.length > 0 && <span className="warning-text"> · {source.warnings.length} extraction notes</span>}</p></div><select aria-label={`Material type for ${source.name}`} value={sourceKinds[source.id] ?? source.kind} onChange={event => {
              const kind = event.target.value as StudySource['kind']; setSourceKinds(current => ({ ...current,[source.id]: kind }));
              updateDeck(current => { const sources = current.sources.map(item => item.id === source.id ? { ...item,kind } : item); const content = buildStudyContent(sources); return { ...current,sources,...content,progress: Object.fromEntries(Object.entries(current.progress).filter(([id]) => content.cards.some(card => card.id === id))) }; });
            }}><option value="notes">Study notes</option><option value="exam">Past test</option></select><button className="button secondary compact" onClick={() => setOpenSource(openSource === source.id ? null : source.id)}>{openSource === source.id ? 'Close' : 'Read text'}<ChevronDown size={14}/></button><button className="icon-button delete-file" aria-label={`Delete ${source.name}`} onClick={() => setConfirmDelete(source.id)}><Trash2 size={16}/></button>
              {openSource === source.id && <div className="extracted-text">{source.warnings.map((warning,index) => <p className="warning-text" key={index}>{warning}</p>)}{source.blocks.map((block,index) => <div key={index}><span className="eyebrow">{block.label}</span><p>{block.text}</p></div>)}</div>}
              {confirmDelete === source.id && <div className="delete-confirm">Remove this material and its study cards?<button className="button secondary compact" onClick={() => setConfirmDelete(null)}>Keep it</button><button className="button danger compact" onClick={() => removeSource(source.id)}>Remove material</button></div>}
            </article>)}</div>
            {!matchingSources.length && <div className="empty-state small"><FolderOpen size={32}/><h3>{query ? 'No matching materials yet.' : 'Add something worth learning.'}</h3><p>{query ? 'Try another concept or file name.' : 'Upload notes to create study cards, or old tests for exam practice.'}</p><button className="button secondary" onClick={() => setUpload('add')}><Plus size={16}/> Add materials</button></div>}
            <div className="section-heading ideas-heading"><div><h2>{query ? 'Matching ideas' : 'Ideas from your notes'}</h2><p>Source excerpts you can check, practice, and revisit.</p></div><span className="muted">Showing {filteredCards.length} of {deck.cards.length}</span></div><div className="ideas-grid">{filteredCards.map(card => <article className="idea-card" key={card.id}><span className="idea-term">{card.term}</span><p>{card.evidence}</p><small>{deck.sources.find(source => source.id === card.sourceId)?.name} · {card.location}</small></article>)}</div>
            <div className="privacy-note"><ShieldCheck size={18}/><p>Materials and progress stay in this browser. Export a backup to move them to another device. Clearing browser data removes local study sets.</p></div>
          </>}
          {view === 'progress' && <>
            <div className="stats-row"><Stat icon={Target} tone="purple" value={`${deckStats.mastery}%`} label="Concepts becoming familiar"/><Stat icon={Check} tone="green" value={`${deckStats.accuracy}%`} label="Correct or rated confident"/><Stat icon={Layers3} tone="orange" value={`${deckStats.reviewed}/${deck.cards.length}`} label="Concepts explored"/><Stat icon={Clock3} tone="blue" value={String(deckStats.due)} label="New or ready to revisit"/></div>
            <div className="progress-columns"><section className="panel"><div className="section-heading"><h2>A little extra attention.</h2><Target size={19}/></div>{focusCards.length ? <>{focusCards.map(card => <div className="focus-concept" key={card.id}><span className="set-dot orange"/><div><strong>{card.term}</strong><small>{deck.sources.find(source => source.id === card.sourceId)?.name}</small></div><span>{deck.progress[card.id].correct}/{deck.progress[card.id].attempts} confident</span></div>)}<button className="button primary" onClick={() => startSession('quiz',true)}>Practice tricky concepts<ArrowRight size={16}/></button></> : <div className="empty-state small"><Leaf size={30}/><h3>{deckStats.attempts ? 'Nothing tricky waiting here.' : 'Your first session starts the story.'}</h3><p>Take a quiz to find out what’s sticking.</p><button className="button secondary" onClick={() => startSession('quiz')}>Start a quiz<ArrowRight size={16}/></button></div>}</section>
            <section className="panel"><div className="section-heading"><h2>Your recent small wins.</h2><Flame size={19}/></div>{deck.sessions.length ? [...deck.sessions].reverse().slice(0,8).map((item,index) => <div className="session-history" key={index}><span className="history-icon"><Check size={16}/></span><div><strong>{item.mode}</strong><small>{new Date(item.time).toLocaleDateString(undefined,{ month: 'short',day: 'numeric' })} · {new Date(item.time).toLocaleTimeString(undefined,{ hour: '2-digit',minute: '2-digit' })}</small></div><span>{item.correct} / {item.total}</span></div>) : <div className="empty-state small"><Clock3 size={30}/><h3>A blank page, full of possibilities.</h3><p>Completed sessions will show up here.</p></div>}</section></div><div className="privacy-note"><Brain size={20}/><p>“Familiar” means two confident reviews in a row. These practice stats include self-ratings and aren’t a prediction of your test score. Past-paper self-ratings are recorded in session history.</p></div>
          </>}
        </>}
        <footer className="main-footer"><span><span className="footer-dot"/> Your pace. Your progress.</span><span>Made for the way you learn.</span></footer>
      </main>
    </div>
    {upload && <UploadDialog existing={upload === 'add' ? deck : undefined} onClose={() => setUpload(null)} onSave={saveUploaded}/>}
    <input ref={backupInput} type="file" accept=".json" className="visually-hidden" aria-label="Restore Quizo backup" onChange={event => { const file = event.target.files?.[0]; if (file) void restoreBackup(file); event.target.value = ''; }}/>
    {toast && <div className="toast" role="status">{toast}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15}/></button></div>}
    {help && <HelpDialog onClose={() => setHelp(false)} onExport={() => downloadBackup(library)}/>}
  </div>;
}
function Stat({ icon: Icon, tone, value, label }: { icon: LucideIcon; tone: string; value: string; label: string }) { return <div className="stat-card"><span className={`stat-icon ${tone}`}><Icon size={21}/></span><div><strong>{value}</strong><p>{label}</p></div></div>; }
function ModeCard({ mode, onClick }: { mode: typeof modes[number]; onClick: () => void }) { return <button className={`mode-card ${mode.tone}`} onClick={onClick}><div className="mode-card-top"><span className={`mode-icon ${mode.tone}`}><mode.icon size={23}/></span><span className="mode-arrow"><ArrowRight size={18}/></span></div><span className="mode-tag">{mode.tag}</span><h3>{mode.title}</h3><p>{mode.description}</p></button>; }
function HelpDialog({ onClose, onExport }: { onClose: () => void; onExport: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); },[]);
  return <dialog ref={ref} className="help-dialog" onCancel={onClose} aria-labelledby="help-title"><div className="dialog-header"><h2 id="help-title">A little guide to Quizo.</h2><button className="icon-button" aria-label="Close help" onClick={onClose}><X size={20}/></button></div><div className="help-content"><p><strong>1. Bring your materials.</strong> Create a study set with PDFs, Word documents, PowerPoint slides, or text. Mark old tests as “Past test”. Check the extracted text in My materials.</p><p><strong>2. Practice actively.</strong> Quizzes remove a key concept from a source sentence. Flashcards, matching, and written recall help you revisit those same ideas in different ways. Past-paper practice shows possible related notes for you to compare.</p><p><strong>3. Come back to tricky bits.</strong> Missed concepts appear in your review queue. Two confident reviews make a concept familiar. Confident cards are scheduled for later; missed cards return sooner.</p><p><strong>Your workspace belongs to this browser.</strong> No sign-in or cloud upload. Export a backup before clearing browser data or switching devices. Files are processed locally; only the extracted text is saved.</p><p><strong>This first version uses text extraction and rules.</strong> It doesn’t yet use AI to understand full documents, generate reasoning questions, or check answers. Image-only scans, diagrams, handwritten notes, legacy DOC/PPT files, and slide speaker notes need another format. Short slide fragments may create few cards; complete sentences work best. Up to 500 source-based cards are distributed across your materials.</p></div><div className="dialog-footer"><button className="button secondary" onClick={onExport}><ArrowDownToLine size={16}/> Export my backup</button><button className="button primary" onClick={onClose}>Got it<Check size={16}/></button></div></dialog>;
}
