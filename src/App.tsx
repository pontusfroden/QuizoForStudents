import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  Flame,
  FolderOpen,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  Leaf,
  LibraryBig,
  ListChecks,
  LoaderCircle,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Library, Mode, StudyDeck, StudySource, View } from './types';
import { demoLibrary } from './lib/demo';
import {
  buildStudyContent,
  GENERATION_VERSION,
  regenerateDeck,
  preserveAiAnswers,
  recordReview,
  stats,
} from './lib/study';
import { reliableText } from './lib/questions';
import { downloadBackup, loadLibrary, saveLibrary, validateBackup } from './lib/storage';
import UploadDialog from './components/UploadDialog';
import StudySession from './components/StudySession';
import AiDialog from './components/AiDialog';
import { applyAiAnswer, type AiAnswer } from './lib/ai';
import { useAutomaticAnswers } from './lib/useAutomaticAnswers';
import { t, useLocale, setLocale, locationLabel, type Locale } from './lib/i18n';

const modes: {
  id: Mode;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  tag: string;
}[] = [
  {
    id: 'flashcards',
    title: 'Flip. Think. Remember.',
    description: 'Small cards. Big “aha” moments.',
    icon: Layers3,
    tone: 'purple',
    tag: 'FLASHCARDS',
  },
  {
    id: 'quiz',
    title: 'Put it to the test.',
    description: 'Find out what’s really sticking.',
    icon: ListChecks,
    tone: 'orange',
    tag: 'QUICK QUIZ',
  },
  {
    id: 'match',
    title: 'Connect the dots.',
    description: 'Match concepts. Make connections.',
    icon: Brain,
    tone: 'green',
    tag: 'MATCH IT',
  },
  {
    id: 'recall',
    title: 'Say it your way.',
    description: 'Explain it. Understand it. Own it.',
    icon: MessageSquareText,
    tone: 'blue',
    tag: 'WRITTEN RECALL',
  },
  {
    id: 'exam',
    title: 'Meet your next exam.',
    description: 'Practice with your past papers.',
    icon: GraduationCap,
    tone: 'pink',
    tag: 'PAST PAPER PRACTICE',
  },
];

export default function App() {
  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
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
  const [ai, setAi] = useState<{ cardId?: string } | null>(null);
  const [sourceKinds, setSourceKinds] = useState<Record<string, StudySource['kind']>>({});
  const backupInput = useRef<HTMLInputElement>(null);
  const saveQueue = useRef(Promise.resolve());
  const preparation = useAutomaticAnswers(library, setLibrary, locale, !!ai || !!upload);
  useEffect(() => {
    let active = true;
    loadLibrary()
      .then((saved) => {
        if (active) {
          const loaded = saved ? validateBackup(saved) : demoLibrary();
          loaded.decks = loaded.decks.map(regenerateDeck);
          setLibrary(loaded);
        }
      })
      .catch(() => {
        if (active) {
          setLibrary(demoLibrary());
          setStorageError('Browser storage could not be read. Export a backup to keep your work.');
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!library) return;
    // Serialise writes so an earlier save can never overwrite a later answer.
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => saveLibrary(library))
      .then(() => setStorageError(''))
      .catch(() =>
        setStorageError(
          'Your browser could not save this change. Export a backup before closing this page.',
        ),
      );
  }, [library]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  if (!library)
    return (
      <div className="loading-screen">
        <span className="brand-mark">
          q<span>•</span>
        </span>
        <LoaderCircle className="spin" />
        <p>{t('Making a little room for learning…')}</p>
      </div>
    );
  const deck = library.decks.find((item) => item.id === library.activeId);
  const deckStats = deck
    ? stats(deck)
    : {
        mastery: 0,
        accuracy: 0,
        reviewed: 0,
        familiar: 0,
        weak: 0,
        attempts: 0,
        correct: 0,
        due: 0,
      };
  function updateDeck(updater: (deck: StudyDeck) => StudyDeck) {
    setLibrary((current) =>
      current
        ? {
            ...current,
            decks: current.decks.map((item) =>
              item.id === current.activeId ? updater(item) : item,
            ),
          }
        : current,
    );
  }
  function navigate(next: View) {
    setView(next);
    setSession(null);
    setQuery('');
    setOpenSource(null);
    setMobileMenu(false);
  }
  function startSession(mode: Mode, weakOnly = false) {
    setSession({ mode, weakOnly });
    setView('study');
    setMobileMenu(false);
    window.scrollTo({ top: 0 });
  }
  function saveAiAnswer(cardId: string, answer: AiAnswer) {
    updateDeck((current) => applyAiAnswer(current, cardId, answer));
  }
  function saveUploaded(title: string, sources: StudySource[]) {
    if (upload === 'add' && deck)
      updateDeck((current) => {
        const replacements = sources.map((source) => ({
          ...source,
          id: current.sources.find((existing) => existing.name === source.name)?.id ?? source.id,
        }));
        const combined = [
          ...current.sources.filter(
            (source) => !replacements.some((incoming) => incoming.name === source.name),
          ),
          ...replacements,
        ];
        const content = preserveAiAnswers(buildStudyContent(combined), current, combined);
        return {
          ...current,
          generationVersion: GENERATION_VERSION,
          title,
          sources: combined,
          ...content,
          progress: Object.fromEntries(
            Object.entries(current.progress).filter(([id]) =>
              content.cards.some((card) => card.id === id),
            ),
          ),
        };
      });
    else {
      const created: StudyDeck = {
        generationVersion: GENERATION_VERSION,
        id: crypto.randomUUID(),
        title,
        description: 'Your notes. Your next breakthrough.',
        createdAt: Date.now(),
        sources,
        ...buildStudyContent(sources),
        progress: {},
        sessions: [],
      };
      setLibrary((current) =>
        current
          ? { ...current, activeId: created.id, decks: [...current.decks, created] }
          : current,
      );
    }
    setUpload(null);
    navigate('overview');
    setToast(t('Your study set is ready. Let’s make it stick.'));
  }
  function removeSource(sourceId: string) {
    updateDeck((current) => {
      const sources = current.sources.filter((source) => source.id !== sourceId);
      const content = preserveAiAnswers(buildStudyContent(sources), current, sources);
      return {
        ...current,
        sources,
        ...content,
        progress: Object.fromEntries(
          Object.entries(current.progress).filter(([id]) =>
            content.cards.some((card) => card.id === id),
          ),
        ),
      };
    });
    setConfirmDelete(null);
    setOpenSource(null);
    setToast(t('Material removed from this study set.'));
  }
  async function restoreBackup(file: File) {
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('The backup file limit is 50 MB.');
      const incoming = validateBackup(JSON.parse(await file.text()));
      setLibrary((current) => {
        if (!current) return incoming;
        // Restore as additional copies, preserving all existing sets and their progress.
        const copies = incoming.decks.map((item) => ({
          ...regenerateDeck(item),
          id: crypto.randomUUID(),
          title: current.decks.some((deck) => deck.title === item.title)
            ? `${item.title} (restored)`
            : item.title,
        }));
        const activeIndex = incoming.decks.findIndex((item) => item.id === incoming.activeId);
        return {
          ...current,
          decks: [...current.decks, ...copies],
          activeId: copies[activeIndex]?.id ?? copies[0]?.id ?? current.activeId,
        };
      });
      navigate('overview');
      setToast(t('Backup restored. Your existing study sets were kept.'));
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not restore this backup.');
    }
  }
  const matchingSources =
    deck?.sources.filter((source) =>
      (source.name + source.blocks.map((block) => block.text).join(' '))
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    ) ?? [];
  const focusCards =
    deck?.cards
      .filter((card) => deck.progress[card.id] && deck.progress[card.id].streak < 2)
      .slice(0, 4) ?? [];
  const filteredCards =
    deck?.cards
      .filter((card) =>
        (card.term + card.evidence).toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      )
      .slice(0, 40) ?? [];
  const questionCards = deck?.isDemo
    ? []
    : (deck?.cards.filter((card) => card.kind === 'question') ?? []);
  const pendingAnswers = questionCards.filter((card) => card.answerStatus === 'missing').length;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            navigate('overview');
          }}
          aria-label="QuizoForStudents home"
        >
          <span className="brand-mark">
            q<span>•</span>
          </span>
          <span>
            quizo<span className="brand-subtitle">FOR STUDENTS</span>
          </span>
        </a>
        <button
          className="button new-set-button"
          onClick={() => {
            setUpload('new');
            setMobileMenu(false);
          }}
        >
          <Plus size={18} /> {t('New study set')}{' '}
        </button>
        <span className="nav-label">{t('YOUR WORKSPACE')}</span>
        <nav aria-label="Main navigation">
          {(
            [
              { id: 'overview', label: t('Overview'), icon: LayoutDashboard },
              { id: 'materials', label: t('My materials'), icon: FolderOpen },
              { id: 'study', label: t('Study modes'), icon: Layers3 },
              { id: 'progress', label: t('My progress'), icon: TrendingUp },
            ] as const
          ).map((item) => (
            <button
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              key={item.id}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} />
              {item.label}
              {item.id === 'materials' && (
                <span className="nav-count">{deck?.sources.length ?? 0}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="set-list-heading">
          <span className="nav-label">{t('STUDY SETS')}</span>
          <button
            className="icon-button"
            aria-label={t('Create another study set')}
            onClick={() => setUpload('new')}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="set-list">
          {library.decks.map((item) => (
            <button
              className={`set-item ${item.id === library.activeId ? 'selected' : ''}`}
              key={item.id}
              onClick={() => {
                setLibrary({ ...library, activeId: item.id });
                navigate('overview');
              }}
            >
              <span className={`set-dot ${item.isDemo ? 'green' : 'purple'}`} />
              <span>{item.title}</span>
              {item.isDemo && <small>DEMO</small>}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="little-reminder">
            <span>
              <Leaf size={19} />
            </span>
            <h4>{t('Progress, a little at a time.')}</h4>
            <p>{t('Ten focused minutes can be a pretty good start.')}</p>
          </div>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={19} /> {t('How Quizo works')}{' '}
          </button>
          <a
            className="github-link"
            href="https://github.com/pontusfroden/QuizoForStudents"
            target="_blank"
            rel="noreferrer"
          >
            {t('Made for curious minds')} <ArrowRight size={13} />
          </a>
        </div>
      </aside>
      {mobileMenu && (
        <button
          className="mobile-overlay"
          aria-label={t('Close navigation')}
          onClick={() => setMobileMenu(false)}
        />
      )}
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu-button"
              aria-label={t('Open navigation')}
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>{t('My workspace')}</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {view === 'materials'
                ? t('My materials')
                : view === 'study'
                  ? t('Study modes')
                  : view === 'progress'
                    ? t('My progress')
                    : t('Overview')}
            </strong>
          </div>
          <div className="topbar-actions">
            {deck && (
              <button
                className="button secondary compact ai-settings-button"
                onClick={() => setAi({})}
              >
                <Sparkles size={16} />
                {t('AI settings')}
              </button>
            )}
            <label className="search-box">
              <Search size={17} />
              <input
                aria-label={t('Search your materials')}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (session) setSession(null);
                  if (view !== 'materials') setView('materials');
                }}
                placeholder={t('Find a concept or file…')}
              />
              <span>⌕</span>
            </label>
            <select
              className="language-select"
              aria-label={t('Interface language')}
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
            >
              <option value="en">{t('English')}</option>
              <option value="sv">Svenska</option>
            </select>
            <button
              className="avatar"
              aria-label={t('How your local workspace works')}
              onClick={() => setHelp(true)}
            >
              S<span />
            </button>
          </div>
        </header>
        <main>
          {deck && pendingAnswers > 0 && (
            <div className="answer-preparation" role="status">
              {preparation.running ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Sparkles size={18} />
              )}
              <div>
                <strong>
                  {t('Preparing answers automatically · {ready}/{total} ready', {
                    ready: questionCards.length - pendingAnswers,
                    total: questionCards.length,
                  })}
                </strong>
                <p>
                  {preparation.error && preparation.deckId === deck.id
                    ? preparation.error
                    : t(
                        'Answer keys are used first. Missing answers are created in the background and saved as they finish.',
                      )}
                </p>
              </div>
              {!preparation.running && (
                <button
                  className="button secondary compact"
                  onClick={() => {
                    preparation.retry();
                    setAi({});
                  }}
                >
                  {t('AI settings')}
                </button>
              )}
            </div>
          )}
          {storageError && (
            <div className="inline-error" role="alert">
              {storageError}
              <button className="text-button" onClick={() => downloadBackup(library)}>
                {t('Export backup')}{' '}
              </button>
            </div>
          )}
          {!deck ? (
            <div className="empty-state">
              <LibraryBig size={42} />
              <h1>{t('A fresh start for your next test.')}</h1>
              <p>{t('Add your first study set to turn notes into practice.')}</p>
              <button className="button primary" onClick={() => setUpload('new')}>
                <Plus size={18} /> {t('Create a study set')}{' '}
              </button>
            </div>
          ) : session ? (
            <StudySession
              key={`${deck.id}-${session.mode}-${session.weakOnly}`}
              deck={deck}
              mode={session.mode}
              weakOnly={session.weakOnly}
              onRequestAnswer={(cardId) => setAi({ cardId })}
              onClose={() => navigate('overview')}
              onReview={(id, correct) =>
                updateDeck((current) => ({
                  ...current,
                  progress: {
                    ...current.progress,
                    [id]: recordReview(current.progress[id], correct),
                  },
                }))
              }
              onFinish={(mode, correct, total) =>
                updateDeck((current) => ({
                  ...current,
                  sessions: [...current.sessions, { time: Date.now(), mode, correct, total }].slice(
                    -200,
                  ),
                }))
              }
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {view === 'overview'
                      ? t('A LITTLE PRACTICE. A LOT MORE CONFIDENCE.')
                      : deck.title.toUpperCase()}
                  </div>
                  <h1>
                    {view === 'overview'
                      ? t('Good things take a little practice.')
                      : view === 'materials'
                        ? t('Your knowledge starts here.')
                        : view === 'study'
                          ? t('Find your way to “I get it”.')
                          : t('Every little step counts.')}
                  </h1>
                  <p>
                    {view === 'overview'
                      ? t('Big test coming up? Let’s break it into small wins.')
                      : view === 'materials'
                        ? t('Your notes, slides, and past papers. All working together.')
                        : view === 'study'
                          ? t('Different ways to practice. The same next breakthrough.')
                          : t('See what’s sticking and what needs another look.')}
                  </p>
                </div>
                <button className="button secondary compact" onClick={() => setUpload('add')}>
                  <Plus size={17} /> {t('Add materials')}{' '}
                </button>
              </div>
              {deck.isDemo && (
                <div className="demo-banner">
                  <span>
                    <Sparkles size={15} /> {t('You’re exploring a sample biology set.')}{' '}
                  </span>
                  <button onClick={() => setUpload('new')}>
                    {t('Try your own notes')} <ArrowRight size={14} />
                  </button>
                </div>
              )}
              {view === 'overview' && (
                <>
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="hero-badge">
                        <Sparkles size={14} /> {t('FROM NOTES TO KNOW-HOW')}{' '}
                      </span>
                      <h2>
                        {t('Big notes.')} <br />
                        {t('Small steps.')} <span className="hero-underline" />
                      </h2>
                      <p>
                        {t('Your material, turned into moments that stick.')} <br />
                        {t('A little less overwhelm. A lot more understanding.')}{' '}
                      </p>
                      <button className="button hero-button" onClick={() => startSession('quiz')}>
                        {t('Let’s get learning')} <ArrowRight size={17} />
                      </button>
                      <span className="hero-footnote">
                        {t('Your next small win is one quiz away.')}
                      </span>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <span className="orbit orbit-one" />
                      <span className="orbit orbit-two" />
                      <span className="art-spark one">✦</span>
                      <span className="art-spark two">✧</span>
                      <span className="art-dot" />
                      <div className="floating-note back-note">
                        <span>{t('little steps')}</span>
                        <div />
                        <div />
                        <div />
                      </div>
                      <div className="floating-note front-note">
                        <span className="note-label">
                          <span /> {t('A QUICK CHECK-IN')}{' '}
                        </span>
                        <strong>
                          {t('What if learning')} <br />
                          {t('felt a little lighter?')}{' '}
                        </strong>
                        <div className="note-answer">
                          <span>
                            <Check size={14} />
                          </span>{' '}
                          {t('One idea at a time.')}{' '}
                        </div>
                        <div className="mini-card-footer">
                          <span>01 / ∞</span>
                          <ArrowRight size={17} />
                        </div>
                      </div>
                      <div className="art-chip">
                        <span>
                          <Check size={13} />
                        </span>{' '}
                        {t('You’ve got this.')}{' '}
                      </div>
                    </div>
                  </section>
                  <div className="stats-row">
                    <Stat
                      icon={FileText}
                      tone="purple"
                      value={String(deck.sources.length)}
                      label={t('Materials, connected')}
                    />
                    <Stat
                      icon={Layers3}
                      tone="orange"
                      value={String(deck.cards.length)}
                      label={t('Ideas to explore')}
                    />
                    <Stat
                      icon={Target}
                      tone="green"
                      value={`${deckStats.mastery}%`}
                      label={t('Concepts becoming familiar')}
                    />
                    <Stat
                      icon={Flame}
                      tone="pink"
                      value={String(deck.sessions.length)}
                      label={t('Sessions under your belt')}
                    />
                  </div>
                  <div className="section-heading">
                    <div>
                      <h2>{t('A way to learn for every mood.')}</h2>
                      <p>{t('Start small. Switch it up. Find what clicks.')}</p>
                    </div>
                    <button className="text-button" onClick={() => navigate('study')}>
                      {t('All study modes')} <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="mode-grid overview-modes">
                    {modes.slice(0, 4).map((mode) => (
                      <ModeCard key={mode.id} mode={mode} onClick={() => startSession(mode.id)} />
                    ))}
                  </div>
                  <div className="overview-bottom">
                    <section className="material-preview">
                      <div className="section-heading">
                        <h2>{t('Your current chapter.')}</h2>
                        <button className="text-button" onClick={() => navigate('materials')}>
                          {t('View all')} <ArrowRight size={15} />
                        </button>
                      </div>
                      <div className="current-set">
                        <span className="subject-icon">
                          <BookOpen size={25} />
                        </span>
                        <div>
                          <h3>{deck.title}</h3>
                          <p>{deck.description}</p>
                          <div className="set-meta">
                            <span>
                              <FileText size={13} />
                              {deck.sources.length} {t('materials')}{' '}
                            </span>
                            <span>
                              <Layers3 size={13} />
                              {deck.cards.length} {t('ideas')}{' '}
                            </span>
                          </div>
                        </div>
                        <button
                          className="icon-button"
                          aria-label={t('View study set materials')}
                          onClick={() => navigate('materials')}
                        >
                          <MoreHorizontal size={20} />
                        </button>
                      </div>
                      <div className="set-progress-label">
                        <span>
                          {deckStats.reviewed} {t('of')} {deck.cards.length}{' '}
                          {t('concepts explored')}{' '}
                        </span>
                        <strong>
                          {deckStats.mastery}
                          {t('% familiar')}
                        </strong>
                      </div>
                      <div className="progress-track">
                        <span style={{ width: `${deckStats.mastery}%` }} />
                      </div>
                      <button
                        className="text-button continue-button"
                        onClick={() => startSession('flashcards')}
                      >
                        {t('Pick up a little knowledge')} <ArrowRight size={15} />
                      </button>
                    </section>
                    <section className="focus-panel">
                      <span className="focus-icon">
                        <Target size={21} />
                      </span>
                      <h3>
                        {deckStats.weak
                          ? t('A second look goes a long way.')
                          : t('Your next small win.')}
                      </h3>
                      <p>
                        {deckStats.weak
                          ? t(
                              '{count} concepts could use another visit. Let’s give them a little attention.',
                              { count: deckStats.weak },
                            )
                          : t(
                              'Start a quick quiz. We’ll remember the tricky bits so you know what to practice next.',
                            )}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => startSession('quiz', deckStats.weak > 0)}
                      >
                        {deckStats.weak ? t('Review tricky concepts') : t('Try a quick quiz')}
                        <ArrowRight size={15} />
                      </button>
                    </section>
                  </div>
                </>
              )}
              {view === 'study' && (
                <>
                  <div className="mode-grid all-modes">
                    {modes.map((mode) => (
                      <ModeCard key={mode.id} mode={mode} onClick={() => startSession(mode.id)} />
                    ))}
                  </div>
                  <div className="study-tip">
                    <span>
                      <Clock3 size={24} />
                    </span>
                    <div>
                      <h3>{t('A rhythm that works for you.')}</h3>
                      <p>
                        {t(
                          'Quiz yourself, revisit tricky concepts, and come back tomorrow. Your review queue puts missed answers and due cards first.',
                        )}{' '}
                      </p>
                    </div>
                    <button
                      className="button secondary"
                      disabled={!deckStats.weak}
                      onClick={() => startSession('quiz', true)}
                    >
                      {t('Review')} {deckStats.weak} {t('tricky concepts')} <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              )}
              {view === 'materials' && (
                <>
                  <div className="materials-toolbar">
                    <span>
                      {deck.sources.length} {t('materials ·')}{' '}
                      {deck.sources
                        .reduce((sum, source) => sum + source.wordCount, 0)
                        .toLocaleString()}{' '}
                      {t('words')}{' '}
                    </span>
                    <div className="button-row">
                      <button className="text-button" onClick={() => downloadBackup(library)}>
                        <ArrowDownToLine size={15} /> {t('Export backup')}{' '}
                      </button>
                      <button className="text-button" onClick={() => backupInput.current?.click()}>
                        <ArrowUpFromLine size={15} /> {t('Restore backup')}{' '}
                      </button>
                    </div>
                  </div>
                  <div className="material-list">
                    {matchingSources.map((source) => (
                      <article className="material-row" key={source.id}>
                        <span
                          className={`file-icon ${source.kind === 'exam' ? 'orange' : source.format === 'PPTX' ? 'green' : 'purple'}`}
                        >
                          <FileText size={23} />
                          <small>{source.format}</small>
                        </span>
                        <div className="file-info">
                          <h3>{source.name}</h3>
                          <p>
                            {source.wordCount.toLocaleString()} {t('words ·')}{' '}
                            {source.coverage ? (
                              t('{read} of {total} pages read', {
                                read: source.coverage.textPages + source.coverage.ocrPages,
                                total: source.coverage.totalPages,
                              })
                            ) : (
                              <>
                                {source.blocks.length}{' '}
                                {source.format === 'PDF'
                                  ? t('pages')
                                  : source.format === 'PPTX'
                                    ? t('slides')
                                    : t('sections')}
                              </>
                            )}
                            {!!source.coverage?.unreadPages.length && (
                              <span className="warning-text">
                                {' '}
                                ·{' '}
                                {t('{count} pages need attention', {
                                  count: source.coverage.unreadPages.length,
                                })}
                              </span>
                            )}
                            {source.warnings.length > 0 && (
                              <span className="warning-text">
                                {' '}
                                · {source.warnings.length} {t('extraction notes')}{' '}
                              </span>
                            )}
                          </p>
                        </div>
                        <select
                          aria-label={`Material type for ${source.name}`}
                          value={sourceKinds[source.id] ?? source.kind}
                          onChange={(event) => {
                            const kind = event.target.value as StudySource['kind'];
                            setSourceKinds((current) => ({ ...current, [source.id]: kind }));
                            updateDeck((current) => {
                              const sources = current.sources.map((item) =>
                                item.id === source.id ? { ...item, kind } : item,
                              );
                              const content = preserveAiAnswers(
                                buildStudyContent(sources),
                                current,
                                sources,
                              );
                              return {
                                ...current,
                                sources,
                                ...content,
                                progress: Object.fromEntries(
                                  Object.entries(current.progress).filter(([id]) =>
                                    content.cards.some((card) => card.id === id),
                                  ),
                                ),
                              };
                            });
                          }}
                        >
                          <option value="notes">{t('Study notes')}</option>
                          <option value="exam">{t('Past test')}</option>
                        </select>
                        <button
                          className="button secondary compact"
                          onClick={() => setOpenSource(openSource === source.id ? null : source.id)}
                        >
                          {openSource === source.id ? t('Close') : t('Read text')}
                          <ChevronDown size={14} />
                        </button>
                        <button
                          className="icon-button delete-file"
                          aria-label={`Delete ${source.name}`}
                          onClick={() => setConfirmDelete(source.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                        {openSource === source.id && (
                          <div className="extracted-text">
                            {source.warnings.map((warning, index) => (
                              <p className="warning-text" key={index}>
                                {warning}
                              </p>
                            ))}
                            {source.blocks.map((block, index) => (
                              <div key={index}>
                                <span className="eyebrow">{locationLabel(block.label)}</span>
                                {block.method === 'ocr' && (
                                  <small className="warning-text">
                                    {t('Scan text · review against the original')}
                                  </small>
                                )}
                                {block.image && (
                                  <img
                                    className="source-image"
                                    src={block.image}
                                    alt={t('Source image')}
                                  />
                                )}
                                {reliableText(block) || !block.text ? (
                                  <p>{block.text}</p>
                                ) : (
                                  <>
                                    <p className="warning-text">
                                      {t(
                                        'Uncertain text and administrative content are excluded from study facts. Review the original source.',
                                      )}
                                    </p>
                                    <details>
                                      <summary>{t('Show unverified extracted text')}</summary>
                                      <p>{block.text}</p>
                                    </details>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {confirmDelete === source.id && (
                          <div className="delete-confirm">
                            {t('Remove this material and its study cards?')}{' '}
                            <button
                              className="button secondary compact"
                              onClick={() => setConfirmDelete(null)}
                            >
                              {t('Keep it')}{' '}
                            </button>
                            <button
                              className="button danger compact"
                              onClick={() => removeSource(source.id)}
                            >
                              {t('Remove material')}{' '}
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                  {!matchingSources.length && (
                    <div className="empty-state small">
                      <FolderOpen size={32} />
                      <h3>
                        {query
                          ? t('No matching materials yet.')
                          : t('Add something worth learning.')}
                      </h3>
                      <p>
                        {query
                          ? t('Try another concept or file name.')
                          : t(
                              'Upload study material to create flashcards, quizzes, and visual practice.',
                            )}
                      </p>
                      <button className="button secondary" onClick={() => setUpload('add')}>
                        <Plus size={16} /> {t('Add materials')}{' '}
                      </button>
                    </div>
                  )}
                  <div className="section-heading ideas-heading">
                    <div>
                      <h2>{query ? t('Matching ideas') : t('Ideas from your notes')}</h2>
                      <p>{t('Source excerpts you can check, practice, and revisit.')}</p>
                    </div>
                    <span className="muted">
                      {t('Showing')} {filteredCards.length} {t('of')} {deck.cards.length}
                    </span>
                  </div>
                  <div className="ideas-grid">
                    {filteredCards.map((card) => (
                      <article className="idea-card" key={card.id}>
                        <span className="idea-term">{card.term}</span>
                        {card.kind === 'image' ? (
                          <img
                            className="match-image"
                            src={
                              deck.sources
                                .find((source) => source.id === card.sourceId)
                                ?.blocks.find((block) => block.label === card.location)?.image
                            }
                            alt={t('Source image')}
                          />
                        ) : (
                          <p>{card.kind === 'question' ? card.prompt : card.evidence}</p>
                        )}
                        {card.kind === 'image' ? (
                          <small>{t('Visual recall · compare with the original image')}</small>
                        ) : (
                          card.answerStatus === 'missing' && (
                            <small>
                              {t('Practice question · no verified answer in the source')}
                            </small>
                          )
                        )}
                        <small>
                          {deck.sources.find((source) => source.id === card.sourceId)?.name} ·{' '}
                          {locationLabel(card.location)}
                        </small>
                      </article>
                    ))}
                  </div>
                  <div className="privacy-note">
                    <ShieldCheck size={18} />
                    <p>
                      {t(
                        'Materials and progress stay in this browser. Export a backup to move them to another device. Clearing browser data removes local study sets.',
                      )}{' '}
                    </p>
                  </div>
                </>
              )}
              {view === 'progress' && (
                <>
                  <div className="stats-row">
                    <Stat
                      icon={Target}
                      tone="purple"
                      value={`${deckStats.mastery}%`}
                      label={t('Concepts becoming familiar')}
                    />
                    <Stat
                      icon={Check}
                      tone="green"
                      value={`${deckStats.accuracy}%`}
                      label={t('Correct or rated confident')}
                    />
                    <Stat
                      icon={Layers3}
                      tone="orange"
                      value={`${deckStats.reviewed}/${deck.cards.length}`}
                      label={t('Concepts explored')}
                    />
                    <Stat
                      icon={Clock3}
                      tone="blue"
                      value={String(deckStats.due)}
                      label={t('New or ready to revisit')}
                    />
                  </div>
                  <div className="progress-columns">
                    <section className="panel">
                      <div className="section-heading">
                        <h2>{t('A little extra attention.')}</h2>
                        <Target size={19} />
                      </div>
                      {focusCards.length ? (
                        <>
                          {focusCards.map((card) => (
                            <div className="focus-concept" key={card.id}>
                              <span className="set-dot orange" />
                              <div>
                                <strong>{card.term}</strong>
                                <small>
                                  {deck.sources.find((source) => source.id === card.sourceId)?.name}
                                </small>
                              </div>
                              <span>
                                {deck.progress[card.id].correct}/{deck.progress[card.id].attempts}{' '}
                                {t('confident')}{' '}
                              </span>
                            </div>
                          ))}
                          <button
                            className="button primary"
                            onClick={() => startSession('quiz', true)}
                          >
                            {t('Practice tricky concepts')} <ArrowRight size={16} />
                          </button>
                        </>
                      ) : (
                        <div className="empty-state small">
                          <Leaf size={30} />
                          <h3>
                            {deckStats.attempts
                              ? t('Nothing tricky waiting here.')
                              : t('Your first session starts the story.')}
                          </h3>
                          <p>{t('Take a quiz to find out what’s sticking.')}</p>
                          <button className="button secondary" onClick={() => startSession('quiz')}>
                            {t('Start a quiz')} <ArrowRight size={16} />
                          </button>
                        </div>
                      )}
                    </section>
                    <section className="panel">
                      <div className="section-heading">
                        <h2>{t('Your recent small wins.')}</h2>
                        <Flame size={19} />
                      </div>
                      {deck.sessions.length ? (
                        [...deck.sessions]
                          .reverse()
                          .slice(0, 8)
                          .map((item, index) => (
                            <div className="session-history" key={index}>
                              <span className="history-icon">
                                <Check size={16} />
                              </span>
                              <div>
                                <strong>{item.mode}</strong>
                                <small>
                                  {new Date(item.time).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                  })}{' '}
                                  ·{' '}
                                  {new Date(item.time).toLocaleTimeString(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </small>
                              </div>
                              <span>
                                {item.correct} / {item.total}
                              </span>
                            </div>
                          ))
                      ) : (
                        <div className="empty-state small">
                          <Clock3 size={30} />
                          <h3>{t('A blank page, full of possibilities.')}</h3>
                          <p>{t('Completed sessions will show up here.')}</p>
                        </div>
                      )}
                    </section>
                  </div>
                  <div className="privacy-note">
                    <Brain size={20} />
                    <p>
                      {t(
                        '“Familiar” means two confident reviews in a row. These practice stats include self-ratings and aren’t a prediction of your test score. Past-paper self-ratings are recorded in session history.',
                      )}{' '}
                    </p>
                  </div>
                </>
              )}
            </>
          )}
          <footer className="main-footer">
            <span>
              <span className="footer-dot" /> {t('Your pace. Your progress.')}{' '}
            </span>
            <span>{t('Made for the way you learn.')}</span>
          </footer>
        </main>
      </div>
      {upload && (
        <UploadDialog
          existing={upload === 'add' ? deck : undefined}
          onClose={() => setUpload(null)}
          onSave={saveUploaded}
        />
      )}
      <input
        ref={backupInput}
        type="file"
        accept=".json"
        className="visually-hidden"
        aria-label={t('Restore Quizo backup')}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void restoreBackup(file);
          event.target.value = '';
        }}
      />
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            className="icon-button"
            aria-label={t('Dismiss notification')}
            onClick={() => setToast('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {help && (
        <HelpDialog onClose={() => setHelp(false)} onExport={() => downloadBackup(library)} />
      )}
      {ai && deck && (
        <AiDialog
          deck={deck}
          cardId={ai.cardId}
          onAnswer={saveAiAnswer}
          onClose={() => setAi(null)}
        />
      )}
    </div>
  );
}
function Stat({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: LucideIcon;
  tone: string;
  value: string;
  label: string;
}) {
  return (
    <div className="stat-card">
      <span className={`stat-icon ${tone}`}>
        <Icon size={21} />
      </span>
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
      </div>
    </div>
  );
}
function ModeCard({ mode, onClick }: { mode: (typeof modes)[number]; onClick: () => void }) {
  return (
    <button className={`mode-card ${mode.tone}`} onClick={onClick}>
      <div className="mode-card-top">
        <span className={`mode-icon ${mode.tone}`}>
          <mode.icon size={23} />
        </span>
        <span className="mode-arrow">
          <ArrowRight size={18} />
        </span>
      </div>
      <span className="mode-tag">{t(mode.tag)}</span>
      <h3>{t(mode.title)}</h3>
      <p>{t(mode.description)}</p>
    </button>
  );
}
function HelpDialog({ onClose, onExport }: { onClose: () => void; onExport: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="help-dialog" onCancel={onClose} aria-labelledby="help-title">
      <div className="dialog-header">
        <h2 id="help-title">{t('A little guide to Quizo.')}</h2>
        <button className="icon-button" aria-label={t('Close help')} onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="help-content">
        <p>
          <strong>{t('1. Bring your materials.')}</strong>{' '}
          {t(
            'Create a study set with documents, images, spreadsheets, or text. Check the extracted content and images in My materials. Every category works in every study mode.',
          )}{' '}
        </p>
        <p>
          <strong>{t('2. Practice actively.')}</strong>{' '}
          {t(
            'Practice facts, complete questions, short lists, or source images in different ways. Source answer keys enable grading. Without a key, reveal study support and assess your recall.',
          )}{' '}
        </p>
        <p>
          <strong>{t('3. Come back to tricky bits.')}</strong>{' '}
          {t(
            'Missed concepts appear in your review queue. Two confident reviews make a concept familiar. Confident cards are scheduled for later; missed cards return sooner.',
          )}{' '}
        </p>
        <p>
          <strong>{t('Your workspace belongs to this browser.')}</strong>{' '}
          {t(
            'No sign-in or cloud upload. Export a backup before clearing browser data or switching devices. Extracted text, image previews, cards, and progress stay in this browser.',
          )}{' '}
        </p>
        <p>
          <strong>{t('This first version uses text extraction and rules.')}</strong>{' '}
          {t(
            'Cards can use facts, questions, lists, and images. Readable answer keys are linked to questions. Local Ollama can generate missing answers and explanations without separate notes. AI suggestions are labelled and need review; essays remain self-assessed.',
          )}{' '}
        </p>
      </div>
      <div className="dialog-footer">
        <button className="button secondary" onClick={onExport}>
          <ArrowDownToLine size={16} /> {t('Export my backup')}{' '}
        </button>
        <button className="button primary" onClick={onClose}>
          {t('Got it')} <Check size={16} />
        </button>
      </div>
    </dialog>
  );
}
