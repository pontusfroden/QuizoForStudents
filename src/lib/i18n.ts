import { useSyncExternalStore } from 'react';
export type Locale = 'en' | 'sv';
const translations: Record<string, string> = {
  'Create a study set with documents, images, spreadsheets, or text. Check the extracted content and images in My materials. Every category works in every study mode.':
    'Skapa en studiesamling med dokument, bilder, tabeller eller text. Kontrollera innehållet och bilderna i Mitt material. Alla kategorier fungerar i alla studielägen.',
  'Practice facts, complete questions, short lists, or source images in different ways. Source answer keys enable grading. Without a key, reveal study support and assess your recall.':
    'Öva på fakta, hela frågor, korta listor eller källbilder på olika sätt. Facit i källan möjliggör rättning. Utan facit kan du visa studiestöd och bedöma vad du minns.',
  'No sign-in or cloud upload. Export a backup before clearing browser data or switching devices. Extracted text, image previews, cards, and progress stay in this browser.':
    'Ingen inloggning eller uppladdning till molnet. Exportera en säkerhetskopia innan du rensar webbläsardata eller byter enhet. Extraherad text, källbilder, kort och framsteg sparas i den här webbläsaren.',
  'Check the original PDF. Retained page images can be used for visual practice when text cannot be read.':
    'Kontrollera originalet. Sparade sidbilder kan användas för bildrepetition när texten inte går att läsa.',
  'Uncertain text and administrative content are excluded from study facts. Review the original source.':
    'Osäker text och administrativa uppgifter används inte som fakta i övningarna. Kontrollera originalet.',
  'Visual recall · compare with the original image': 'Bildövning · jämför med originalbilden',
  'Practice questions from your material. Attempt an answer, reveal source support, and rate your recall.':
    'Öva på frågor från ditt material. Försök svara, visa stöd från källan och bedöm vad du kan.',
  'Match questions, concepts, or images to their source excerpts.':
    'Para ihop frågor, begrepp eller bilder med rätt utdrag ur källan.',
  'Every material type can create practice cards: facts, questions, lists, and source images. OCR that needs review is excluded from automatic facts. Questions without a source answer remain practice questions with self-assessment. This local version does not invent an answer key or automatically grade essays.':
    'Alla typer av studiematerial kan ge övningskort: fakta, frågor, punktlistor och källbilder. Osäker OCR används inte som fakta. Frågor utan facit går att öva på med självbedömning. Den lokala versionen hittar inte på facit och rättar inte uppsatssvar automatiskt.',
  'The image preview limit was reached. Split this document to review additional images.':
    'Gränsen för källbilder har nåtts. Dela dokumentet för att granska fler bilder.',
  'Image could not be read.': 'Bilden kunde inte läsas.',
  Image: 'Bild',
  Sheet: 'Blad',
  'Use a document, image, spreadsheet, or text file listed in the upload box.':
    'Använd ett dokument, en bild, en tabell eller en textfil av en typ som visas i uppladdningsrutan.',
  'Image text could not be read. The original image is available for visual practice.':
    'Bildens text kunde inte läsas. Originalbilden finns kvar för bildrepetition.',
  'Uncertain image text is excluded from automatic facts. Use the image for visual practice.':
    'Osäker bildtext används inte som fakta. Bilden kan användas för bildrepetition.',
  'This file does not contain readable document content.':
    'Filen innehåller inget läsbart dokumentinnehåll.',
  'No readable study content was found. Try another file or use an image for visual practice.':
    'Inget läsbart studiematerial hittades. Prova en annan fil eller en bild för bildrepetition.',
  'correct or self-rated confident': 'rätt eller självbedömda som säkra',
  'Source image': 'Källbild',
  'Study the image, hide it, and recall its main points.':
    'Studera bilden, dölj den och återge det viktigaste.',
  'Visual recall · compare with the source image': 'Bildrepetition · jämför med källbilden',
  'Practice question · no verified answer in the source':
    'Övningsfråga · verifierat facit saknas i källan',
  'Show image': 'Visa bilden',
  'Hide image and recall': 'Dölj bilden och försök minnas',
  'Try answering in your own words, then reveal the source support.':
    'Försök svara med egna ord och visa sedan stödet från källan.',
  'Reveal study support': 'Visa studiestöd',
  'There is no verified answer in this source. Explain the relevant concepts, give an example, and check that you addressed every part of the question.':
    'Källan innehåller inget verifierat facit. Förklara de relevanta begreppen, ge ett exempel och kontrollera att du besvarat alla delar av frågan.',
  'Compare what you recalled with the original image. You can practice this page without adding notes.':
    'Jämför det du mindes med originalbilden. Du kan öva på sidan utan att lägga till anteckningar.',
  'Define the key concepts in the question.': 'Definiera frågans viktigaste begrepp.',
  'Explain the relationships or steps in your own words.':
    'Förklara samband eller steg med egna ord.',
  'Give a concrete example and justify your answer.':
    'Ge ett konkret exempel och motivera ditt svar.',
  'Original question and alternatives': 'Originalfråga och svarsalternativ',
  'Uncertain OCR text is excluded from study facts. Use the source image to review it.':
    'Osäker OCR-text används inte som studiefakta. Kontrollera innehållet i källbilden.',
  'Show unverified extracted text': 'Visa osäker extraherad text',
  'Documents, images, spreadsheets, or text · Up to 30 MB each':
    'Dokument, bilder, tabeller eller text · Högst 30 MB per fil',
  'Practice questions and source facts work in every study mode. No separate notes are required.':
    'Övningsfrågor och fakta från dina filer fungerar i alla studielägen. Separata anteckningar behövs inte.',
  'Upload study material to create flashcards, quizzes, and visual practice.':
    'Ladda upp studiematerial för övningskort, quiz och bildrepetition.',
  'Add at least a few words of study material.':
    'Lägg till åtminstone några ord med studiematerial.',
  'A PDF image could not be decoded. This page is unread, not blank.':
    'En bild i PDF-filen kunde inte läsas. Sidan är oläst, inte tom.',
  'Check page coverage and OCR notes against the original PDF before studying.':
    'Kontrollera sidantal och OCR-anmärkningar mot originalfilen innan du studerar.',
  'At least half the pages rendered blank. Check the original PDF before relying on this study set.':
    'Minst hälften av sidorna såg tomma ut vid läsningen. Kontrollera originalfilen innan du använder studiesamlingen.',
  'Study extracted pages': 'Studera de lästa sidorna',
  'Interface language': 'Gränssnittets språk',
  'Making a little room for learning…': 'Förbereder din studieplats…',
  Review: 'Repetera',
  'tricky concepts': 'svåra begrepp',
  'materials ·': 'material ·',
  words: 'ord',
  Showing: 'Visar',
  confident: 'säkra',
  document: 'dokument',
  '{count} documents · {words} words extracted': '{count} dokument · {words} ord extraherade',
  '{name} · page {page} of {total}': '{name} · sida {page} av {total}',
  '{name} · scanning page {page} of {total}…': '{name} · läser skannad sida {page} av {total}…',
  'Reading scan · {percent}%': 'Läser skannad sida · {percent} %',
  'Preparing scan reader…': 'Förbereder skanningsläsaren…',
  '{name} · page {page}/{total} · {message}': '{name} · sida {page}/{total} · {message}',
  'Reading {name}…': 'Läser {name}…',
  'Page {page}: scan text may contain recognition errors. Check the extracted text before studying.':
    'Sida {page}: den skannade texten kan innehålla tolkningsfel. Kontrollera texten innan du studerar.',
  'Page {page}: scan reading failed. {message}':
    'Sida {page}: skanningen kunde inte läsas. {message}',
  '{count} of {total} pages could not be fully read (pages {pages}).':
    '{count} av {total} sidor kunde inte läsas fullständigt (sidor {pages}).',
  'Enable scanned-page reading and upload again.':
    'Aktivera läsning av skannade sidor och ladda upp igen.',
  'Check the original PDF; handwriting, diagrams, and poor scans may need manual notes.':
    'Kontrollera PDF-originalet. Handskrift, diagram och otydliga skanningar kan behöva egna anteckningar.',
  '{count} blank pages skipped (pages {pages}).':
    '{count} tomma sidor hoppades över (sidor {pages}).',
  'No usable text found.': 'Ingen användbar text hittades.',
  'The pages appear blank.': 'Sidorna verkar vara tomma.',
  'Scan reading could not recover enough text. Try a clearer scan or paste the text.':
    'Skanningen gav inte tillräckligt med text. Prova en tydligare skanning eller klistra in texten.',
  'OCR took too long on this page. Try a smaller PDF or a clearer scan.':
    'Textläsningen tog för lång tid. Prova en mindre PDF eller en tydligare skanning.',
  'Create a study set with PDFs, Word documents, PowerPoint slides, or text. Mark old tests as “Past test”. Check the extracted text in My materials.':
    'Skapa en studiesamling med PDF-filer, Word-dokument, PowerPoint-bilder eller text. Markera gamla prov som ”Gammalt prov”. Kontrollera den extraherade texten under Mitt material.',
  'Quizzes remove a key concept from a source sentence. Flashcards, matching, and written recall help you revisit those same ideas in different ways. Past-paper practice shows possible related notes for you to compare.':
    'Quiz döljer ett begrepp i en mening från källan. Övningskort, matchning och egna svar hjälper dig att repetera samma begrepp på olika sätt. Övning på gamla prov visar material som kan vara relevant att jämföra med.',
  'Missed concepts appear in your review queue. Two confident reviews make a concept familiar. Confident cards are scheduled for later; missed cards return sooner.':
    'Begrepp du missar hamnar i din repetitionskö. Efter två säkra svar blir begreppet bekant. Säkra kort visas igen senare och missade kort kommer tillbaka tidigare.',
  'No sign-in or cloud upload. Export a backup before clearing browser data or switching devices. Files are processed locally; only the extracted text is saved.':
    'Ingen inloggning eller uppladdning till molnet. Exportera en säkerhetskopia innan du rensar webbläsardata eller byter enhet. Filer bearbetas lokalt och bara den extraherade texten sparas.',
  'It doesn’t yet use AI to understand full documents, generate reasoning questions, or check answers. Image-only scans now use local OCR in Swedish and English. Handwriting, diagrams, formulas, legacy DOC/PPT files, and slide speaker notes may need manual notes or another format. Short slide fragments may create few cards; complete sentences work best. Up to 500 source-based cards are distributed across your materials.':
    'Appen använder ännu inte AI för att förstå hela dokument, skapa resonemangsfrågor eller rätta svar. Skannade PDF-sidor läses med lokal OCR på svenska och engelska. Handskrift, diagram, formler, gamla DOC/PPT-filer och föreläsaranteckningar kan behöva egna anteckningar eller ett annat format. Hela meningar fungerar bäst. Upp till 500 källbaserade kort fördelas över materialet.',
  'New study set': 'Ny studiesamling',
  'Create another study set': 'Skapa en ny studiesamling',
  'YOUR WORKSPACE': 'DIN STUDIEPLATS',
  'STUDY SETS': 'STUDIESAMLINGAR',
  Overview: 'Översikt',
  'My materials': 'Mitt material',
  'Study modes': 'Studielägen',
  'My progress': 'Mina framsteg',
  'My workspace': 'Min studieplats',
  'How Quizo works': 'Så fungerar Quizo',
  'How your local workspace works': 'Så fungerar din lokala studieplats',
  'Open navigation': 'Öppna menyn',
  'Close navigation': 'Stäng menyn',
  'Search your materials': 'Sök i ditt material',
  'Find a concept or file…': 'Sök efter begrepp eller filer…',
  'Progress, a little at a time.': 'Framsteg, ett steg i taget.',
  'Ten focused minutes can be a pretty good start.': 'Tio fokuserade minuter är en bra början.',
  'Made for curious minds': 'För nyfikna människor',
  'Your pace. Your progress.': 'Din takt. Dina framsteg.',
  'Made for the way you learn.': 'Skapat för ditt sätt att lära.',
  'A LITTLE PRACTICE. A LOT MORE CONFIDENCE.': 'LITE ÖVNING. MYCKET MER SJÄLVFÖRTROENDE.',
  'Good things take a little practice.': 'Lite övning gör stor skillnad.',
  'Big test coming up? Let’s break it into small wins.':
    'Snart dags för prov? Vi tar det i små steg.',
  'Your knowledge starts here.': 'Din kunskap börjar här.',
  'Your notes, slides, and past papers. All working together.':
    'Dina anteckningar, presentationer och gamla tentor. På samma plats.',
  'Find your way to “I get it”.': 'Hitta ditt sätt att förstå.',
  'Different ways to practice. The same next breakthrough.':
    'Olika sätt att öva. Samma mål: att förstå.',
  'Every little step counts.': 'Varje litet steg räknas.',
  'See what’s sticking and what needs another look.':
    'Se vad du kan och vad du behöver öva mer på.',
  'Add materials': 'Lägg till material',
  'You’re exploring a sample biology set.': 'Du tittar på ett exempelmaterial i biologi.',
  'Try your own notes': 'Prova ditt eget material',
  'FROM NOTES TO KNOW-HOW': 'FRÅN ANTECKNINGAR TILL KUNSKAP',
  'Big notes.': 'Mycket material.',
  'Small steps.': 'Små steg.',
  'Your material, turned into moments that stick.': 'Ditt material blir till kunskap som fastnar.',
  'A little less overwhelm. A lot more understanding.':
    'Lite mindre stress. Mycket mer förståelse.',
  'Let’s get learning': 'Börja öva',
  'Your next small win is one quiz away.': 'Ditt nästa framsteg börjar med ett quiz.',
  'little steps': 'små steg',
  'A QUICK CHECK-IN': 'EN SNABB KOLL',
  'What if learning': 'Tänk om lärandet',
  'felt a little lighter?': 'kändes lite enklare?',
  'One idea at a time.': 'Ett begrepp i taget.',
  'You’ve got this.': 'Du klarar det.',
  'Materials, connected': 'Material att studera',
  'Ideas to explore': 'Begrepp att utforska',
  'Concepts becoming familiar': 'Begrepp du börjar kunna',
  'Sessions under your belt': 'Genomförda övningar',
  'A way to learn for every mood.': 'Ett sätt att lära för varje tillfälle.',
  'Start small. Switch it up. Find what clicks.': 'Börja smått. Variera dig. Hitta vad som passar.',
  'All study modes': 'Alla studielägen',
  Flashcards: 'Övningskort',
  FLASHCARDS: 'ÖVNINGSKORT',
  'Flip. Think. Remember.': 'Vänd. Tänk. Kom ihåg.',
  'Small cards. Big “aha” moments.': 'Små kort. Stora aha-upplevelser.',
  'Quick quiz': 'Snabbquiz',
  'QUICK QUIZ': 'SNABBQUIZ',
  'Put it to the test.': 'Testa dina kunskaper.',
  'Find out what’s really sticking.': 'Ta reda på vad som har fastnat.',
  'Match it': 'Para ihop',
  'MATCH IT': 'PARA IHOP',
  'Connect the dots.': 'Hitta sambanden.',
  'Match concepts. Make connections.': 'Para ihop begrepp. Hitta samband.',
  'Written recall': 'Svara med egna ord',
  'WRITTEN RECALL': 'SVARA MED EGNA ORD',
  'Say it your way.': 'Förklara med egna ord.',
  'Explain it. Understand it. Own it.': 'Förklara. Förstå. Kom ihåg.',
  'Past paper practice': 'Öva på gamla tentor',
  'PAST PAPER PRACTICE': 'GAMLA TENTOR',
  'Meet your next exam.': 'Förbered dig för nästa tenta.',
  'Practice with your past papers.': 'Öva med dina gamla prov och tentor.',
  'Your current chapter.': 'Din aktuella studiesamling.',
  'View all': 'Visa alla',
  'View study set materials': 'Visa studiesamlingens material',
  materials: 'material',
  ideas: 'begrepp',
  'concepts explored': 'begrepp övade',
  '% familiar': '% bekanta',
  'Pick up a little knowledge': 'Öva på några begrepp',
  'A second look goes a long way.': 'En repetition gör stor skillnad.',
  'Your next small win.': 'Ditt nästa lilla framsteg.',
  'Start a quick quiz. We’ll remember the tricky bits so you know what to practice next.':
    'Börja med ett snabbquiz. Vi sparar de svåra begreppen så att du vet vad du ska öva på.',
  'Review tricky concepts': 'Repetera svåra begrepp',
  'Try a quick quiz': 'Prova ett snabbquiz',
  'A rhythm that works for you.': 'En studietakt som passar dig.',
  'Quiz yourself, revisit tricky concepts, and come back tomorrow. Your review queue puts missed answers and due cards first.':
    'Testa dig själv, repetera svåra begrepp och kom tillbaka imorgon. Felaktiga svar och kort som behöver repeteras kommer först.',
  'Export backup': 'Exportera säkerhetskopia',
  'Restore backup': 'Återställ säkerhetskopia',
  'Read text': 'Läs texten',
  Close: 'Stäng',
  'Study notes': 'Studiematerial',
  'Past test': 'Gammalt prov',
  pages: 'sidor',
  slides: 'bilder',
  sections: 'avsnitt',
  'sections ·': 'avsnitt ·',
  'words ·': 'ord ·',
  'words extracted': 'ord extraherade',
  'extraction notes': 'anmärkningar',
  'Remove this material and its study cards?': 'Ta bort materialet och dess övningskort?',
  'Keep it': 'Behåll',
  'Remove material': 'Ta bort material',
  'Matching ideas': 'Matchande begrepp',
  'Ideas from your notes': 'Begrepp från ditt material',
  'Source excerpts you can check, practice, and revisit.':
    'Utdrag ur källorna som du kan kontrollera och öva på.',
  'No matching materials yet.': 'Inga matchande material.',
  'Add something worth learning.': 'Lägg till något att lära dig.',
  'Try another concept or file name.': 'Prova ett annat begrepp eller filnamn.',
  'Upload notes to create study cards, or old tests for exam practice.':
    'Ladda upp anteckningar för övningskort eller gamla prov för att öva på tentafrågor.',
  'A little extra attention.': 'Lite extra övning.',
  'Your recent small wins.': 'Dina senaste framsteg.',
  'Practice tricky concepts': 'Öva på svåra begrepp',
  'Start a quiz': 'Starta ett quiz',
  'Correct or rated confident': 'Rätt eller bedömt som säkert',
  'Concepts explored': 'Begrepp övade',
  'New or ready to revisit': 'Nya eller dags att repetera',
  'Nothing tricky waiting here.': 'Inga svåra begrepp att repetera.',
  'Your first session starts the story.': 'Din första övning är början.',
  'Take a quiz to find out what’s sticking.': 'Gör ett quiz för att se vad du kan.',
  'A blank page, full of possibilities.': 'En tom sida, full av möjligheter.',
  'Completed sessions will show up here.': 'Genomförda övningar visas här.',
  'A fresh start for your next test.': 'En ny start inför nästa prov.',
  'Add your first study set to turn notes into practice.':
    'Skapa din första studiesamling för att öva på ditt material.',
  'Create a study set': 'Skapa en studiesamling',
  'Back to your study set': 'Tillbaka till studiesamlingen',
  'A LITTLE PRACTICE GOES A LONG WAY': 'LITE ÖVNING GÖR STOR SKILLNAD',
  'Make the connections.': 'Hitta sambanden.',
  'Let’s see what sticks.': 'Se vad du kommer ihåg.',
  'A focused round with concepts that need another look.':
    'En fokuserad övning med begrepp du behöver repetera.',
  'Practice questions from your old tests. Write your answer, compare with related notes, and rate yourself.':
    'Öva på frågor från gamla prov. Skriv ditt svar, jämför med relevanta anteckningar och bedöm dig själv.',
  'Connect five concepts to their source definitions. Take your time; understanding comes first.':
    'Para ihop fem begrepp med sina definitioner. Ta den tid du behöver; förståelsen kommer först.',
  'Explain a concept in your own words, then compare it with the original notes.':
    'Förklara ett begrepp med egna ord och jämför sedan med originalmaterialet.',
  'Recall the concept, flip the card, and tell us how it went.':
    'Försök komma ihåg begreppet, vänd kortet och bedöm ditt svar.',
  'Fill in the missing concept. Every answer comes straight from your notes.':
    'Fyll i begreppet som saknas. Varje svar kommer direkt från ditt material.',
  'Session length': 'Antal frågor',
  '5 questions · a quick warm-up': '5 frågor · en snabb uppvärmning',
  '10 questions · a focused session': '10 frågor · en fokuserad övning',
  '20 questions · a deeper dive': '20 frågor · lite mer fördjupning',
  '50 questions · the full stretch': '50 frågor · en längre övning',
  Start: 'Starta',
  questions: 'frågor',
  pairs: 'par',
  'Your progress is saved after each answer.': 'Dina framsteg sparas efter varje svar.',
  'No weak concepts yet. Finish a quiz to find your focus areas.':
    'Inga svåra begrepp ännu. Gör ett quiz för att hitta vad du behöver öva på.',
  'No usable study cards yet. Add notes with complete sentences or definitions.':
    'Inga användbara övningskort ännu. Lägg till anteckningar med hela meningar eller definitioner.',
  'Upload a past test and mark its file type as “Past test” to use this mode.':
    'Ladda upp ett gammalt prov och markera det som ”Gammalt prov” för att använda detta läge.',
  'ONE STEP CLOSER': 'ETT STEG NÄRMARE',
  'Look at you go.': 'Bra jobbat!',
  'That’s how learning happens.': 'Så lär du dig.',
  of: 'av',
  'rated confident': 'bedömda som säkra',
  'correct on the first try': 'rätt på första försöket',
  'Revisit these later to help them stick.': 'Repetera dem senare för att få kunskapen att fastna.',
  'The tricky concepts are waiting in your review queue.':
    'De svåra begreppen finns i din repetitionskö.',
  'Another round': 'En gång till',
  'Back to overview': 'Tillbaka till översikten',
  'Find their other half.': 'Hitta rätt definition.',
  'Choose a concept and its definition. A mismatch means both concepts go into your review queue.':
    'Välj ett begrepp och dess definition. Vid fel hamnar båda begreppen i din repetitionskö.',
  'Almost. Try a different connection.': 'Nästan. Prova en annan kombination.',
  'YOUR PAST PAPER': 'DITT GAMLA PROV',
  'COMPLETE THE IDEA': 'FYLL I BEGREPPET',
  'RECALL BEFORE YOU REVEAL': 'FÖRSÖK MINNAS INNAN DU VISAR SVARET',
  'This set has one answer concept. Try recalling it yourself.':
    'Denna samling har ett begrepp. Försök komma ihåg svaret själv.',
  'Your quiz answer': 'Ditt quizsvar',
  'Check answer': 'Kontrollera svaret',
  'Your written answer': 'Ditt skriftliga svar',
  'Close your notes. Put the idea into your own words…':
    'Stäng anteckningarna. Förklara med egna ord…',
  'Flip card': 'Vänd kortet',
  'Compare with notes': 'Jämför med materialet',
  'That’s it!': 'Rätt!',
  'Compare with the source': 'Jämför med källan',
  'No clear matching note was found. Compare with your course material or marking guide; this app does not invent an answer key.':
    'Inget tydligt matchande material hittades. Jämför med kursmaterialet eller facit. Appen hittar inte på ett facit.',
  'source keywords appear in your answer. This is a hint, not an automatic grade.':
    'nyckelord från källan finns i ditt svar. Det är ett stöd, inte automatisk rättning.',
  'Related notes are suggestions, not a verified marking guide.':
    'Det relaterade materialet är förslag, inte ett kontrollerat facit.',
  'See results': 'Visa resultat',
  'Next question': 'Nästa fråga',
  'How did you do?': 'Hur gick det?',
  'Needs practice': 'Behöver övas',
  'Got it': 'Jag kan det',
  'Source ·': 'Källa ·',
  'Tip: press space to flip the card': 'Tips: tryck på mellanslag för att vända kortet',
  'End session': 'Avsluta övningen',
  'YOUR NEXT LEARNING ADVENTURE': 'NÄSTA STEG I DITT LÄRANDE',
  'Add your materials': 'Lägg till ditt material',
  'Make room for a new idea.': 'Skapa en ny studiesamling.',
  'Close upload': 'Stäng uppladdningen',
  'Study set name': 'Studiesamlingens namn',
  'e.g. Biology · Chapter 4': 't.ex. Biologi · Kapitel 4',
  'All your material. One place.': 'Allt ditt material. En plats.',
  'Drop your notes, slides, and past papers here.':
    'Dra dina anteckningar, presentationer och gamla tentor hit.',
  'Choose files': 'Välj filer',
  'Upload study files': 'Ladda upp studiefiler',
  'PDF, DOCX, PPTX, TXT, MD · Up to 30 MB each': 'PDF, DOCX, PPTX, TXT, MD · Högst 30 MB per fil',
  'Or paste your notes instead': 'Eller klistra in dina anteckningar',
  'Paste study notes': 'Klistra in studiematerial',
  'Paste a few paragraphs, a chapter, or practice questions…':
    'Klistra in några stycken, ett kapitel eller övningsfrågor…',
  'Pasted material type': 'Typ av inklistrat material',
  'Your materials are ready.': 'Ditt material är klart.',
  'Some materials need a review.': 'En del material behöver kontrolleras.',
  'Back to files': 'Tillbaka till filerna',
  'Processed on this device. No account needed.': 'Bearbetas på denna enhet. Inget konto behövs.',
  'Let’s study': 'Börja studera',
  'Build my study set': 'Skapa min studiesamling',
  'Reading materials…': 'Läser material…',
  'Give your study set a name first.': 'Ge studiesamlingen ett namn först.',
  'Add at least a few sentences of notes.': 'Lägg till åtminstone några meningar med anteckningar.',
  'Add a document or paste some notes first.':
    'Lägg till en fil eller klistra in anteckningar först.',
  'Upload up to 25 files at a time.': 'Ladda upp högst 25 filer åt gången.',
  'Pasted notes': 'Inklistrade anteckningar',
  'Scanned PDF pages': 'Skannade PDF-sidor',
  'Read scanned pages automatically': 'Läs skannade sidor automatiskt',
  'Read every PDF page as an image': 'Läs varje PDF-sida som en bild',
  'Only read embedded PDF text': 'Läs bara inbäddad PDF-text',
  'Document language': 'Dokumentets språk',
  'Swedish + English': 'Svenska + engelska',
  Swedish: 'Svenska',
  English: 'Engelska',
  'Scanned pages take longer. Text stays on your device. Handwriting and formulas may be inaccurate.':
    'Skannade sidor tar längre tid. Texten stannar på din enhet. Handskrift och formler kan bli fel.',
  'Cancel reading': 'Avbryt läsningen',
  'Reading cancelled. Your files are still selected.':
    'Läsningen avbröts. Dina filer är fortfarande valda.',
  'Scan text · review against the original': 'Skannad text · kontrollera mot originalet',
  'Some pages were not read. Review the details below before studying.':
    'Vissa sidor kunde inte läsas. Kontrollera informationen nedan innan du börjar öva.',
  'Show extraction notes': 'Visa anmärkningar',
  Page: 'Sida',
  Slide: 'Bild',
  Section: 'Avsnitt',
  'What do you remember about {term}?': 'Vad kommer du ihåg om {term}?',
  'The answer is {answer}.': 'Svaret är {answer}.',
  '{read} of {total} pages read': '{read} av {total} sidor lästa',
  '{count} pages read with OCR': '{count} sidor lästa med OCR',
  '{count} page read with OCR': '{count} sida läst med OCR',
  'Blank page {page} skipped.': 'Tom sida {page} hoppades över.',
  '{count} blank pages skipped': '{count} tomma sidor hoppades över',
  '{count} pages need attention': '{count} sidor behöver kontrolleras',
  '{count} concepts could use another visit. Let’s give them a little attention.':
    '{count} begrepp behöver repeteras. Vi övar lite mer på dem.',
  'Your study set is ready. Let’s make it stick.':
    'Din studiesamling är klar. Nu får vi kunskapen att fastna.',
  'Material removed from this study set.': 'Materialet togs bort från studiesamlingen.',
  'Backup restored. Your existing study sets were kept.':
    'Säkerhetskopian återställdes. Dina tidigare studiesamlingar finns kvar.',
  'Restore Quizo backup': 'Återställ Quizo-säkerhetskopia',
  'Dismiss notification': 'Stäng meddelandet',
  'A little guide to Quizo.': 'En liten guide till Quizo.',
  'Close help': 'Stäng hjälpen',
  'Export my backup': 'Exportera säkerhetskopia',
  '1. Bring your materials.': '1. Lägg till ditt material.',
  '2. Practice actively.': '2. Öva aktivt.',
  '3. Come back to tricky bits.': '3. Repetera svåra begrepp.',
  'Your workspace belongs to this browser.': 'Din studieplats tillhör den här webbläsaren.',
  'This first version uses text extraction and rules.':
    'Denna första version använder textextraktion och regler.',
  'Materials and progress stay in this browser. Export a backup to move them to another device. Clearing browser data removes local study sets.':
    'Material och framsteg sparas i den här webbläsaren. Exportera en säkerhetskopia för att flytta dem till en annan enhet. Om du rensar webbläsardata försvinner de lokala studiesamlingarna.',
  '“Familiar” means two confident reviews in a row. These practice stats include self-ratings and aren’t a prediction of your test score. Past-paper self-ratings are recorded in session history.':
    '”Bekant” betyder två säkra svar i rad. Statistiken innehåller självbedömningar och förutsäger inte ditt provresultat. Självbedömningar av gamla prov sparas i övningshistoriken.',
};

function initialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem('quizo-language');
    if (saved === 'sv' || saved === 'en') return saved;
  } catch {
    /* Storage is optional. */
  }
  return navigator.language.startsWith('sv') ? 'sv' : 'en';
}
let locale = initialLocale();
const listeners = new Set<() => void>();
export function setLocale(next: Locale) {
  locale = next;
  try {
    localStorage.setItem('quizo-language', next);
  } catch {
    /* Keep the current session usable. */
  }
  document.documentElement.lang = next;
  listeners.forEach((listener) => listener());
}
export function useLocale() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => locale,
  );
}
export function t(key: string, values: Record<string, string | number> = {}): string {
  const text = locale === 'sv' ? (translations[key] ?? key) : key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}
export function locationLabel(label: string): string {
  return label.replace(
    /\b(Page|Slide|Section|Image|Sheet)\s+(?=\d)/g,
    (value) => t(value.trim()) + ' ',
  );
}
