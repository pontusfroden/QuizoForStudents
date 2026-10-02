import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, Flag, RotateCcw, Sparkles, X } from 'lucide-react';
import { keywords, optionsFor, shuffle, studyQueue } from '../lib/study';
import type { Mode, StudyCard, StudyDeck } from '../types';

interface Props { deck: StudyDeck; mode: Mode; weakOnly: boolean; onClose: () => void; onReview: (cardId: string, correct: boolean) => void; onFinish: (mode: string, correct: number, total: number) => void }
export default function StudySession(props: Props) {
  const [round, setRound] = useState(0);
  const [questionCount, setQuestionCount] = useState(10);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [written, setWritten] = useState('');
  const [score, setScore] = useState(0);
  const [complete, setComplete] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [matched, setMatched] = useState<string[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [selectedDefinition, setSelectedDefinition] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [matchMistakes, setMatchMistakes] = useState<Set<string>>(new Set());
  const finalised = useRef(false);
  const initialDeck = useRef(props.deck);
  const deck = initialDeck.current;
  const queue = useMemo(() => studyQueue(deck, props.weakOnly), [deck, props.weakOnly, round]);
  const matchCards = useMemo(() => {
    const seen = new Set<string>();
    return queue.filter(card => { const term = card.term.toLocaleLowerCase(); if (seen.has(term)) return false; seen.add(term); return true; }).slice(0,5);
  }, [queue]);
  const matchDefinitions = useMemo(() => shuffle(matchCards), [matchCards]);
  const sessionCards = queue.slice(0, questionCount);
  const exams = deck.examPrompts.slice(0,questionCount);
  const total = props.mode === 'match' ? matchCards.length : props.mode === 'exam' ? exams.length : sessionCards.length;
  const card = sessionCards[index];
  const exam = exams[index];
  const options = useMemo(() => card ? optionsFor(card, deck.cards) : [], [card, deck.cards]);
  const name = { quiz: 'Quick quiz', flashcards: 'Flashcards', match: 'Match it', recall: 'Written recall', exam: 'Past paper practice' }[props.mode];
  const finish = (finalScore: number) => {
    if (!finalised.current) { props.onFinish(name, finalScore, total); finalised.current = true; }
    setComplete(true);
  };
  function next(correct: boolean, review = true) {
    if (review && card) props.onReview(card.id, correct);
    const nextScore = score + Number(correct); setScore(nextScore);
    if (index + 1 >= total) finish(nextScore);
    else { setIndex(index + 1); setSelected(null); setRevealed(false); setWritten(''); setSourceOpen(false); }
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches('input,textarea,select,button') || !started || complete || props.mode !== 'flashcards') return;
      if (event.code === 'Space') { event.preventDefault(); setRevealed(value => !value); }
    };
    window.addEventListener('keydown',handler); return () => window.removeEventListener('keydown',handler);
  }, [started, complete, props.mode]);
  function reset() {
    setRound(value => value + 1); setIndex(0); setRevealed(false); setSelected(null); setWritten(''); setScore(0); setComplete(false); setStarted(false); setMatched([]); setMatchMistakes(new Set()); setSelectedTerm(null); setSelectedDefinition(null); finalised.current = false;
  }
  function tryMatch(termId: string | null, definitionId: string | null) {
    if (!termId || !definitionId) return;
    if (termId === definitionId) {
      const correct = !matchMistakes.has(termId);
      props.onReview(termId, correct);
      const nextScore = score + Number(correct); setScore(nextScore);
      const nextMatched = [...matched,termId]; setMatched(nextMatched); setSelectedTerm(null); setSelectedDefinition(null); setMismatch(false);
      if (nextMatched.length === matchCards.length) finish(nextScore);
    } else { setMismatch(true); setMatchMistakes(current => new Set([...current,termId,definitionId])); }
  }
  const related = exam?.relatedCardIds.map(id => deck.cards.find(card => card.id === id)).filter((card): card is StudyCard => !!card) ?? [];
  return <div className="session-shell"><div className="session-heading"><button className="text-button" onClick={props.onClose}><ArrowLeft size={17}/> Back to your study set</button><span className="session-mode"><Sparkles size={15}/>{name}</span></div>
    {!started ? <div className="session-intro"><span className="large-mode-icon"><Sparkles size={30}/></span><span className="eyebrow">A LITTLE PRACTICE GOES A LONG WAY</span><h1>{name === 'Match it' ? 'Make the connections.' : 'Let’s see what sticks.'}</h1><p>{props.weakOnly ? 'A focused round with concepts that need another look.' : props.mode === 'exam' ? 'Practice questions from your old tests. Write your answer, compare with related notes, and rate yourself.' : props.mode === 'match' ? 'Connect five concepts to their source definitions. Take your time; understanding comes first.' : props.mode === 'recall' ? 'Explain a concept in your own words, then compare it with the original notes.' : props.mode === 'flashcards' ? 'Recall the concept, flip the card, and tell us how it went.' : 'Fill in the missing concept. Every answer comes straight from your notes.'}</p>
      {props.mode !== 'match' && <label className="session-length">Session length<select value={questionCount} onChange={event => setQuestionCount(Number(event.target.value))}><option value={5}>5 questions · a quick warm-up</option><option value={10}>10 questions · a focused session</option><option value={20}>20 questions · a deeper dive</option><option value={50}>50 questions · the full stretch</option></select></label>}
      <button className="button primary" disabled={total === 0 || (props.mode === 'match' && total < 2)} onClick={() => setStarted(true)}>Start {total} {props.mode === 'match' ? 'pairs' : 'questions'}<ArrowRight size={16}/></button>
      {total === 0 && <p className="warning-text">{props.mode === 'exam' ? 'Upload a past test and mark its file type as “Past test” to use this mode.' : props.weakOnly ? 'No weak concepts yet. Finish a quiz to find your focus areas.' : 'No usable study cards yet. Add notes with complete sentences or definitions.'}</p>}
      <small>Your progress is saved after each answer.</small></div> : complete ? <div className="session-intro completion"><span className="large-mode-icon"><CheckCircle2 size={34}/></span><span className="eyebrow">ONE STEP CLOSER</span><h1>{score === total ? 'Look at you go.' : 'That’s how learning happens.'}</h1><p>{score} of {total} {props.mode === 'exam' || props.mode === 'flashcards' || props.mode === 'recall' ? 'rated confident' : 'correct on the first try'}. {score === total ? 'Revisit these later to help them stick.' : 'The tricky concepts are waiting in your review queue.'}</p><div className="completion-score">{Math.round(score / total * 100)}<span>%</span></div><div className="button-row"><button className="button secondary" onClick={reset}><RotateCcw size={16}/> Another round</button><button className="button primary" onClick={props.onClose}>Back to overview<ArrowRight size={16}/></button></div></div> : props.mode === 'match' ? <>
      <div className="session-top"><h1>Find their other half.</h1><span>{matched.length} / {total} pairs</span></div><p className="muted">Choose a concept and its definition. A mismatch means both concepts go into your review queue.</p><div className="match-grid"><div>{matchCards.map(card => <button key={card.id} className={`match-tile term ${matched.includes(card.id) ? 'matched' : ''} ${selectedTerm === card.id ? 'selected' : ''}`} disabled={matched.includes(card.id)} onClick={() => { setMismatch(false); setSelectedTerm(card.id); tryMatch(card.id,selectedDefinition); }}>{card.term}{matched.includes(card.id) && <Check size={18}/>}</button>)}</div><div>{matchDefinitions.map(card => <button key={card.id} className={`match-tile definition ${matched.includes(card.id) ? 'matched' : ''} ${selectedDefinition === card.id ? 'selected' : ''}`} disabled={matched.includes(card.id)} onClick={() => { setMismatch(false); setSelectedDefinition(card.id); tryMatch(selectedTerm,card.id); }}>{card.prompt.replace(/______/g,'[…]')}{matched.includes(card.id) && <Check size={18}/>}</button>)}</div></div>{mismatch && <p role="status" className="match-feedback">Almost. Try a different connection.</p>}
    </> : <>
      <div className="session-top"><h1>{name}</h1><span>{index + 1} / {total}</span></div><div className="progress-track"><span style={{ width: `${index / total * 100}%` }}/></div>
      <div className={`question-panel ${props.mode === 'flashcards' ? 'flashcard-panel' : ''}`}><span className="eyebrow">{props.mode === 'exam' ? 'YOUR PAST PAPER' : props.mode === 'quiz' ? 'COMPLETE THE IDEA' : 'RECALL BEFORE YOU REVEAL'}</span>
        <h2>{props.mode === 'exam' ? exam.prompt : props.mode === 'quiz' ? card.prompt : `What do you remember about ${card.term}?`}</h2>
        {props.mode === 'quiz' && <div className="quiz-options">{options.length >= 2 ? options.map((option,i) => <button className={`quiz-option ${selected !== null && option === card.answer ? 'correct' : ''} ${selected === option && option !== card.answer ? 'incorrect' : ''}`} disabled={selected !== null} key={option} onClick={() => { setSelected(option); props.onReview(card.id,option === card.answer); }}><span>{String.fromCharCode(65 + i)}</span>{option}{selected !== null && option === card.answer && <Check size={18}/>}</button>) : <><p className="muted">This set has one answer concept. Try recalling it yourself.</p><input value={written} aria-label="Your quiz answer" onChange={event => setWritten(event.target.value)} disabled={selected !== null}/><button className="button primary" disabled={!written.trim() || selected !== null} onClick={() => { setSelected(written.trim()); props.onReview(card.id,written.trim().toLocaleLowerCase() === card.answer.toLocaleLowerCase()); }}>Check answer</button></>}</div>}
        {(props.mode === 'recall' || props.mode === 'exam') && <textarea autoFocus aria-label="Your written answer" value={written} onChange={event => setWritten(event.target.value)} disabled={revealed} placeholder="Close your notes. Put the idea into your own words…"/>}
        {props.mode !== 'quiz' && !revealed && <button className="button secondary reveal-button" disabled={(props.mode === 'recall' || props.mode === 'exam') && !written.trim()} onClick={() => setRevealed(true)}><Eye size={17}/>{props.mode === 'flashcards' ? 'Flip card' : 'Compare with notes'}</button>}
        {(revealed || selected !== null) && <div className="answer-reveal" role="status"><strong>{props.mode === 'quiz' ? selected?.toLocaleLowerCase() === card.answer.toLocaleLowerCase() ? 'That’s it!' : `The answer is ${card.answer}.` : 'Compare with the source'}</strong>{props.mode === 'exam' ? related.length ? related.map(relatedCard => <p key={relatedCard.id}>{relatedCard.evidence}<small>{deck.sources.find(s => s.id === relatedCard.sourceId)?.name} · {relatedCard.location}</small></p>) : <p>No clear matching note was found. Compare with your course material or marking guide; this app does not invent an answer key.</p> : <p>{card.evidence}</p>}{props.mode === 'recall' && <small>{keywords(card.evidence).filter(token => keywords(written).includes(token)).length} source keywords appear in your answer. This is a hint, not an automatic grade.</small>}{props.mode === 'exam' && <small>Related notes are suggestions, not a verified marking guide.</small>}</div>}
      </div>
      {(revealed || selected !== null) && <div className="answer-actions">{props.mode === 'quiz' ? <button className="button primary" onClick={() => next(selected?.toLocaleLowerCase() === card.answer.toLocaleLowerCase(),false)}>{index + 1 === total ? 'See results' : 'Next question'}<ArrowRight size={16}/></button> : <><p className="muted">How did you do?</p><button className="button secondary" onClick={() => next(false,props.mode !== 'exam')}><RotateCcw size={16}/> Needs practice</button><button className="button primary" onClick={() => next(true,props.mode !== 'exam')}><Check size={16}/> Got it</button></>}</div>}
      {props.mode !== 'exam' && <details className="source-detail" open={sourceOpen} onToggle={event => setSourceOpen(event.currentTarget.open)}><summary><Flag size={14}/> Source · {deck.sources.find(s => s.id === card.sourceId)?.name} · {card.location}</summary><p>{card.evidence}</p></details>}
      {props.mode === 'flashcards' && <small className="keyboard-hint">Tip: press space to flip the card</small>}
    </>}
    {started && !complete && <button className="text-button end-session" onClick={props.onClose}><X size={15}/> End session</button>}
  </div>;
}
