'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { createFittingClient, fittingModel } from '../lib/fitting-client.mjs';
import { ArrowTopRightIcon, CameraIcon, DownloadIcon, CheckIcon, UploadIcon, Cross2Icon, LockClosedIcon, MixerHorizontalIcon } from '@radix-ui/react-icons';
import { imageError, referenceSize, SESSION_SECONDS } from '../lib/policy.mjs';
import { connectionSummary } from '../lib/connection.mjs';
import { garments, CATEGORIES, garmentPrompt, framingTip } from '../lib/catalog.mjs';
import { deadline } from '../lib/async.mjs';

const statusLabels = { idle: 'Camera off', camera: 'Opening camera', ready: 'Private preview', connecting: 'Starting fitting', live: 'Live fitting', updating: 'Changing look' };

export default function FittingRoom() {
  const localVideo = useRef(null), outputVideo = useRef(null), fileInput = useRef(null);
  const camera = useRef(null), session = useRef(null), generation = useRef(0), selectionVersion = useRef(0);
  const operation = useRef(false), selecting = useRef(false), abort = useRef(null), sessionTimer = useRef(null);
  const [access, setAccess] = useState('checking'), [code, setCode] = useState(''), [unlocking, setUnlocking] = useState(false);
  const [message, setMessage] = useState(''), [phase, setPhase] = useState('idle');
  const [garment, setGarment] = useState(null), [selected, setSelected] = useState(null), [preview, setPreview] = useState('');
  const [category, setCategory] = useState('All pieces'), [uploadCategory, setUploadCategory] = useState('T-shirts');
  const [tab, setTab] = useState('collection'), [prompt, setPrompt] = useState(''), [loadingItem, setLoadingItem] = useState('');
  const [cameraOn, setCameraOn] = useState(false), [hasOutput, setHasOutput] = useState(false), [original, setOriginal] = useState(false);
  const [quality, setQuality] = useState(null), [seconds, setSeconds] = useState(SESSION_SECONDS), [applied, setApplied] = useState(null), [stalled, setStalled] = useState(false);
  const busy = ['camera', 'connecting', 'updating'].includes(phase);
  const live = phase === 'live' || phase === 'updating';
  const dirty = selected && (selected !== applied?.item || prompt !== applied?.prompt);

  function stop() {
    generation.current++;
    abort.current?.abort(); abort.current = null;
    clearInterval(sessionTimer.current); sessionTimer.current = null;
    const connection = session.current; session.current = null;
    connection?.disconnect();
    camera.current?.getTracks().forEach(track => track.stop()); camera.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (outputVideo.current) outputVideo.current.srcObject = null;
    operation.current = false;
    setCameraOn(false); setHasOutput(false); setOriginal(false); setQuality(null); setStalled(false); setApplied(null); setPhase('idle');
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/access', { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => {
      setAccess(data.unlocked ? 'open' : 'locked');
      if (!data.configured) setMessage('Your host is preparing this private studio. Please check back shortly.');
    }).catch(error => { if (error.name !== 'AbortError') { setAccess('locked'); setMessage('Could not check access. Please reload and try again.'); } });
    const hidden = () => { if (document.hidden && (camera.current || operation.current)) { stop(); setMessage('Your fitting stopped while this tab was away. Start again when you’re ready.'); } };
    window.addEventListener('pagehide', stop); document.addEventListener('visibilitychange', hidden);
    return () => { controller.abort(); selectionVersion.current++; window.removeEventListener('pagehide', stop); document.removeEventListener('visibilitychange', hidden); stop(); };
  }, []);

  useEffect(() => {
    if (!garment) return;
    const url = URL.createObjectURL(garment); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [garment]);

  useEffect(() => {
    if (!live) return;
    let previous = -1, changed = Date.now();
    const timer = setInterval(() => {
      const video = outputVideo.current;
      if (video && video.currentTime !== previous && video.readyState >= 2) { previous = video.currentTime; changed = Date.now(); setStalled(false); }
      else if (Date.now() - changed > 15000) { stop(); setMessage('Video stopped arriving. Check your connection, then start another fitting.'); }
      else if (Date.now() - changed > 5000) setStalled(true);
    }, 1000);
    return () => clearInterval(timer);
  }, [live]);

  async function unlock(event) {
    event.preventDefault(); if (unlocking) return;
    setUnlocking(true); setMessage('');
    try {
      const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.trim() }), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setAccess('open'); setCode('');
    } catch (error) { setMessage(error.name === 'TimeoutError' ? 'The studio took too long to respond. Please try again.' : error.message || 'Could not open the studio.'); }
    finally { setUnlocking(false); }
  }

  async function leave() {
    stop();
    try {
      const response = await fetch('/api/access', { method: 'DELETE', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error();
      selectionVersion.current++; selecting.current = false; setLoadingItem(''); setGarment(null); setSelected(null); setPreview(''); setPrompt(''); setAccess('locked'); setMessage('');
    } catch { setMessage('Could not lock the studio. Please try Leave studio again.'); }
  }

  async function choose(item, file) {
    if (operation.current) return;
    const version = ++selectionVersion.current;
    selecting.current = true; setLoadingItem(item?.id || 'upload'); setMessage('');
    try {
      if (item) {
        const response = await fetch(item.image, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('This piece could not be loaded. Please try another.');
        const blob = await response.blob();
        file = new File([blob], `${item.id}.webp`, { type: blob.type || 'image/webp' });
      }
      const invalid = imageError(file); if (invalid) throw new Error(invalid);
      const bitmap = await createImageBitmap(file);
      let reference;
      try {
        const size = referenceSize(bitmap.width, bitmap.height), canvas = document.createElement('canvas');
        canvas.width = size.width; canvas.height = size.height;
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        reference = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .9));
        if (!reference) throw new Error('Could not prepare this image. Please try another.');
      } finally { bitmap.close(); }
      if (version !== selectionVersion.current) return;
      const next = item || { name: file.name, category: uploadCategory, color: 'Your piece', detail: 'Personal upload' };
      setGarment(reference); setSelected(next); setPrompt(garmentPrompt(next.category, next.description));
    } catch (error) {
      if (version === selectionVersion.current) setMessage(error.name === 'InvalidStateError' ? 'That image could not be opened. Try another JPG, PNG or WebP.' : error.name === 'TimeoutError' ? 'The garment took too long to load. Try again.' : error.message);
    } finally { if (version === selectionVersion.current) { selecting.current = false; setLoadingItem(''); } }
  }

  async function enableCamera() {
    if (operation.current) return;
    operation.current = true;
    const current = ++generation.current; setPhase('camera'); setMessage('');
    try {
      const model = fittingModel();
      const stream = await deadline(navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: model.width, max: model.width }, height: { ideal: model.height, max: model.height }, frameRate: model.fps } }), 30000, stream => stream.getTracks().forEach(track => track.stop()));
      if (current !== generation.current) { stream.getTracks().forEach(track => track.stop()); return; }
      camera.current = stream; localVideo.current.srcObject = stream;
      stream.getVideoTracks()[0].addEventListener('ended', () => { if (camera.current === stream) { stop(); setMessage('Camera disconnected. Reconnect it to continue.'); } });
      setCameraOn(true); setPhase('ready');
    } catch (error) {
      if (current !== generation.current) return;
      setPhase('idle'); setMessage(error.name === 'NotAllowedError' ? 'Allow camera access in your browser, then try again.' : 'Camera unavailable. Connect a webcam, allow access and close other apps using it.');
    } finally { if (current === generation.current) operation.current = false; }
  }

  async function start() {
    if (operation.current || selecting.current || !camera.current || !garment || !prompt.trim()) return;
    operation.current = true;
    const current = ++generation.current, chosen = { item: selected, prompt }, controller = new AbortController();
    abort.current = controller;
    setPhase('connecting'); setMessage(''); setOriginal(false); setSeconds(SESSION_SECONDS);
    let publicError = '';
    try {
      const client = createFittingClient({ telemetry: false, tokenProvider: async () => {
        if (current !== generation.current) throw new Error('Cancelled');
        const response = await fetch('/api/token', { method: 'POST', signal: controller.signal });
        const body = await response.json();
        if (!response.ok) { publicError = body.error; throw new Error(publicError); }
        if (current !== generation.current) throw new Error('Cancelled');
        return body.token;
      } });
      const connection = await deadline(client.realtime.connect(camera.current, {
        model: fittingModel(), mirror: true, retries: 0, capacityRetryBudgetMs: 0,
        initialState: { prompt: { text: prompt.trim(), enhance: false }, image: garment },
        onConnectionQuality: report => { if (current === generation.current) setQuality(report); },
        onRemoteStream: stream => { if (current === generation.current && outputVideo.current) outputVideo.current.srcObject = stream; },
        onConnectionChange: state => {
          if (current === generation.current && state === 'disconnected' && session.current) { stop(); setMessage('The connection ended. You can start another fitting.'); }
        },
      }), 25000, connection => connection.disconnect());
      if (current !== generation.current) { connection.disconnect(); return; }
      session.current = connection;
      connection.on('error', () => { if (session.current === connection) { stop(); setMessage('The connection failed. Check your network and try again.'); } });
      connection.on('sessionEnded', ({ reason }) => { if (session.current === connection) { stop(); setMessage(reason === 'insufficient_credits' ? 'The demo needs more credits. Please contact your host.' : 'Your fitting has ended. You can start another session.'); } });
      const ends = Date.now() + SESSION_SECONDS * 1000;
      sessionTimer.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((ends - Date.now()) / 1000)); setSeconds(remaining);
        if (!remaining) { stop(); setMessage(`Your ${SESSION_SECONDS}-second fitting is complete. Start another when you’re ready.`); }
      }, 250);
      setApplied(chosen); setPhase('live');
    } catch {
      if (current === generation.current) { stop(); setMessage(publicError || 'Could not start the fitting. Check your connection or ask your host to check service access.'); }
    } finally { if (current === generation.current) operation.current = false; }
  }

  async function updateOutfit() {
    if (operation.current || selecting.current || !session.current || !garment || !prompt.trim()) return;
    operation.current = true;
    const connection = session.current, chosen = { item: selected, prompt };
    setPhase('updating'); setMessage('');
    try {
      await deadline(connection.set({ image: garment, prompt: prompt.trim(), enhance: false }), 15000);
      if (session.current === connection) { setApplied(chosen); setPhase('live'); setMessage('Look updated. Give the fabric a moment to settle.'); }
    } catch { if (session.current === connection) { stop(); setMessage('The outfit change did not finish. Start a fresh fitting to try it again.'); } }
    finally { if (session.current === connection) operation.current = false; }
  }

  function download() {
    const video = outputVideo.current;
    if (!video?.videoWidth || !hasOutput || stalled || phase !== 'live') return;
    try {
      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const context = canvas.getContext('2d'); context.drawImage(video, 0, 0);
      context.fillStyle = '#20231fe6'; context.fillRect(0, canvas.height - 44, canvas.width, 44);
      context.fillStyle = '#ffffff'; context.font = '16px sans-serif'; context.fillText('wearon.  /  AI fitting preview', 20, canvas.height - 17);
      canvas.toBlob(blob => {
        if (!blob) { setMessage('Could not save this frame. Please try again.'); return; }
        const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `wearon-${Date.now()}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage('Your look was downloaded to this device.');
      }, 'image/png');
    } catch { setMessage('Could not save this frame. Please try again.'); }
  }

  const visible = garments.filter(item => category === 'All pieces' || item.category === category);
  return <div className="shell">
    <header className="site-header"><a className="wordmark" href="/" aria-label="WearOn home">wearon<span>.</span></a><span className="header-note">A new way to find your look.</span><div className="header-actions"><span className="private-label"><LockClosedIcon/> PRIVATE STUDIO</span>{access === 'open' && <button className="text-button" onClick={leave}>Leave studio <ArrowTopRightIcon/></button>}</div></header>
    {access !== 'open' ? <main className="entrance">
      <div className="entrance-copy"><p className="eyebrow">THE WEARON FITTING EXPERIENCE</p><h1>Good style.<br/><span>Your way.</span></h1><p className="lead">Meet your next look before you wear it.<br/>A collection to explore. A mirror that moves with you.</p>
        <form onSubmit={unlock} className="access-form"><label htmlFor="access-code">Your invitation code</label><div className="access-row"><input id="access-code" type="password" autoComplete="off" maxLength={128} placeholder="Enter your private access code" value={code} onChange={event => setCode(event.target.value)} disabled={access === 'checking' || unlocking} required/><button className="primary" disabled={!code.trim() || unlocking || access === 'checking'}>{unlocking ? 'Opening…' : access === 'checking' ? 'Checking…' : 'Enter studio'}<ArrowTopRightIcon/></button></div><p className="feedback" role="status">{message || 'An invitation-only preview. Best experienced on a computer.'}</p></form>
        <div className="entrance-meta"><span>{garments.length} considered looks</span><span>One live fitting room</span></div>
      </div><div className="entrance-art"><span className="art-index">THE EVERYDAY EDIT / 01</span><Image width={1122} height={1402} sizes="(max-width: 800px) 92vw, 45vw" src="/garments/clay-overshirt.webp" alt="Terracotta cotton overshirt from the WearOn collection" fetchPriority="high"/><div className="art-caption"><div><span className="eyebrow">IN THE COLLECTION</span><h2>Made for a different day.</h2></div><ArrowTopRightIcon/></div></div>
    </main> : <main>
      <section className="studio-heading"><div><p className="eyebrow">YOUR PERSONAL FITTING STUDIO</p><h1>Find your <span>next look.</span></h1></div><p>Pick a piece. Step into frame.<br/>See what feels like you.</p></section>
      <div className="desktop-notice">This preview is designed for a computer with a webcam. For the best fitting experience, open it on desktop.</div>
      <section className="workspace" aria-label="Fitting studio"><div className="mirror-column">
        <div className="section-line"><h2>01 <span>The fitting room</span></h2><span>LIVE VIRTUAL TRY-ON</span></div>
        <div className="mirror">
          <div className="mirror-top"><span className="status"><i className={live ? 'active' : ''}/>{stalled ? 'Video interrupted' : live && !hasOutput ? 'Waiting for video' : statusLabels[phase]}</span>{live && <span className="countdown" aria-label={`${seconds} seconds remaining`}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} remaining</span>}</div>
          <div className="video-stage"><video ref={localVideo} className={`camera-video ${cameraOn && (!hasOutput || original) ? 'visible' : ''}`} autoPlay muted playsInline aria-label="Original camera preview"/><video ref={outputVideo} className={hasOutput && !original ? 'visible' : ''} autoPlay muted playsInline onPlaying={() => { if (outputVideo.current?.srcObject && camera.current) setHasOutput(true); }} aria-label="AI fitting preview"/>
            {!cameraOn && <div className="mirror-empty"><div className="frame-guide"><CameraIcon/></div><p className="eyebrow">THE ONLY THING MISSING IS YOU</p><h3>A little change.<br/>A whole new look.</h3><p>Your camera is your fitting room.<br/>Let’s get you in the picture.</p><button className="light-button" onClick={enableCamera} disabled={busy}>{phase === 'camera' ? 'Opening camera…' : 'Enable camera'}<ArrowTopRightIcon/></button><small>Preview stays on your device until you start a fitting.</small></div>}
            {cameraOn && (phase === 'connecting' || live && !hasOutput) && <div className="connecting"><span className="spinner"/>Preparing your fitting…</div>}
            {stalled && <div className="connecting">Waiting for fresh video…</div>}
            {hasOutput && <span className="video-label">{original ? 'ORIGINAL' : 'AI FITTING PREVIEW'}</span>}
          </div>
          <div className="mirror-bottom"><span>{applied ? applied.item.name : 'A space to try something new.'}</span><div>{hasOutput && <button className="mirror-button" onClick={() => setOriginal(!original)}>{original ? 'Show fitting' : 'Compare original'}</button>}{(cameraOn || busy) && <button className="mirror-button" onClick={() => { stop(); setMessage('Camera and fitting stopped.'); }}><Cross2Icon/> Stop</button>}</div></div>
        </div>
        <div className="under-mirror"><p>{framingTip(selected?.category)}</p><button className="download-button" onClick={download} disabled={!hasOutput || stalled || phase !== 'live'}><DownloadIcon/> Save look</button></div>
        {live && <details className="diagnostics"><summary>Connection details</summary><p>{connectionSummary(quality)}</p><p>Video delivery statistics. AI can still distort fabric during movement; start still and turn slowly.</p></details>}
        <details className="how-to" id="how-it-works"><summary>Make the most of your fitting <span>+</span></summary><ol><li><strong>Keep it simple.</strong> Wear one light layer and face an even light source.</li><li><strong>Give it space.</strong> Show your whole torso for tops, your legs for trousers, and your full body for complete outfits.</li><li><strong>Move naturally.</strong> Start still, let the look settle, then turn slowly. Save a frame you like.</li></ol><p>AI previews show an impression of appearance, not accurate sizing or fit. Your host’s demo allowance applies. Each session lasts up to {SESSION_SECONDS} seconds and ends when you leave this tab.</p></details>
      </div><aside className="wardrobe">
        <div className="section-line"><h2>02 <span>Your wardrobe</span></h2><span>THE EVERYDAY EDIT</span></div>
        <div className="wardrobe-tabs"><button aria-pressed={tab === 'collection'} onClick={() => setTab('collection')}>The collection <span>{garments.length}</span></button><button aria-pressed={tab === 'upload'} onClick={() => setTab('upload')}><UploadIcon/> Your own piece</button></div>
        {tab === 'collection' ? <><div className="filters" aria-label="Filter garments">{CATEGORIES.map(value => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div><div className="garment-grid" aria-busy={!!loadingItem}>{visible.map(item => <button className={`garment-card ${selected?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => choose(item)} disabled={busy} aria-pressed={selected?.id === item.id} aria-label={`Select ${item.name}`}><div className="garment-image"><Image sizes="(max-width: 800px) 45vw, 23vw" src={item.image} alt={`${item.color} ${item.category.toLowerCase()}`} loading="lazy" width={1122} height={1402}/><span className="select-mark">{loadingItem === item.id ? <span className="spinner"/> : selected?.id === item.id ? <CheckIcon/> : <ArrowTopRightIcon/>}</span></div><div className="garment-caption"><h3>{item.name}</h3><span>{item.color}</span></div><p>{item.detail}</p></button>)}</div></> : <div className="upload-panel"><h3>Something you’ve had your eye on?</h3><p>Use a clear, front-facing photo against a plain background. For Full outfits, show the top and trousers together in one image.</p><label htmlFor="clothing-type">What kind of piece?</label><select id="clothing-type" value={uploadCategory} disabled={busy || !!loadingItem} onChange={event => { setUploadCategory(event.target.value); if (selected && !selected.id) { setSelected({ ...selected, category: event.target.value }); setPrompt(garmentPrompt(event.target.value)); } }}>{CATEGORIES.slice(1).map(value => <option key={value}>{value}</option>)}</select><input ref={fileInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload garment" disabled={busy} onChange={event => { if (event.target.files[0]) choose(null, event.target.files[0]); event.target.value = ''; }}/><button className="upload-zone" disabled={busy} onClick={() => fileInput.current.click()}><UploadIcon/><strong>{loadingItem === 'upload' ? 'Opening image…' : 'Choose an image'}</strong><span>JPG, PNG or WebP · Up to 10 MB</span></button><p className="hint">Your upload stays in this browser until you start or update a fitting.</p></div>}
        <div className="fitting-controls">{selected ? <div className="selected-piece"><img src={preview} alt="Selected reference"/><div><span className="eyebrow">{live && !dirty ? 'CURRENT LOOK' : 'READY TO TRY'}</span><h3>{selected.name}</h3><p>{selected.category} · {selected.color}</p></div><CheckIcon/></div> : <p className="choose-hint">Choose a piece above to make it yours.</p>}
          {selected && <details className="prompt-settings"><summary><MixerHorizontalIcon/> Adjust fitting instructions</summary><label htmlFor="prompt">Describe how to wear it</label><textarea id="prompt" rows={3} maxLength={1500} value={prompt} disabled={busy} onChange={event => setPrompt(event.target.value)}/><p className="hint">Changing pieces resets these instructions to match the garment.</p></details>}
          <button className="primary start-button" disabled={!cameraOn || !garment || busy || !!loadingItem || !prompt.trim() || live && !dirty} onClick={live ? updateOutfit : start}>{phase === 'connecting' ? 'Preparing your fitting…' : phase === 'updating' ? 'Changing your look…' : live ? dirty ? 'Try this piece' : 'You’re wearing this look' : `Start ${SESSION_SECONDS}-second fitting`}{live && !dirty ? <CheckIcon/> : <ArrowTopRightIcon/>}</button>
          <p className="feedback" role="status" aria-live="polite">{message || (!cameraOn ? 'Enable your camera to begin.' : !garment ? 'Choose a piece from the collection or upload your own.' : live && dirty ? 'Your new piece is selected. Apply it when you’re ready.' : 'Ready for a different point of view.')}</p>
          <p className="privacy"><LockClosedIcon/> Starting sends video and the garment to the configured fitting service. Audio is off. WearOn does not store your video or uploads.</p>
        </div>
      </aside></section>
    </main>}
    <footer><span className="footer-brand">wearon.</span><span>Less wondering. More wearing.</span><a href="#how-it-works">How it works <ArrowTopRightIcon/></a></footer>
  </div>;
}
