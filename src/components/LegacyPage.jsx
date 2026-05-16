import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pageToRoute } from '../pages';
import bgMusic from '../assets/bg-music.mp3';

const injectedScriptAttr = 'data-legacy-script';
const injectedStyleAttr = 'data-legacy-style';

const normalizeAssetPath = (input) => {
  if (!input) return input;
  if (/^(https?:|data:|mailto:|tel:|#)/i.test(input)) return input;
  return input.replace(/^\.\//, '/').replace(/^(?!\/)/, '/');
};

const extractHtml = (raw) => {
  const parser = new DOMParser();
  return parser.parseFromString(raw, 'text/html');
};

const loadScriptsSequentially = async (scripts) => {
  for (const src of scripts) {
    await new Promise((resolve) => {
      const node = document.createElement('script');
      node.src = normalizeAssetPath(src);
      node.async = false;
      node.setAttribute(injectedScriptAttr, 'true');
      node.onload = resolve;
      node.onerror = resolve;
      document.body.appendChild(node);
    });
  }
};

const runLegacyLoadLifecycle = () => {
  if (window.jQuery) {
    window.jQuery(window).triggerHandler('load');
    window.jQuery(window).triggerHandler('scroll');
    window.jQuery(window).triggerHandler('resize');
  } else {
    window.dispatchEvent(new Event('load'));
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
  }

  const preloader = document.querySelector('.preloader');
  if (preloader) {
    preloader.style.display = 'none';
  }
};

export default function LegacyPage() {
  const navigate = useNavigate();
  const [html, setHtml] = useState('');
  const [notFound, setNotFound] = useState(false);

  const htmlPath = '/legacy-pages/index.html';

  useEffect(() => {
    const audio = document.createElement('audio');
    audio.src = bgMusic;
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.4;
    audio.muted = true;
    audio.autoplay = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.style.display = 'none';
    document.body.appendChild(audio);

    const startAudio = () => {
      audio.play().catch(() => {});
    };

    const onFirstInteraction = () => {
      audio.muted = false;
      startAudio();
      document.removeEventListener('pointerdown', onFirstInteraction);
      document.removeEventListener('touchstart', onFirstInteraction);
      document.removeEventListener('keydown', onFirstInteraction);
    };

    startAudio();
    window.addEventListener('load', startAudio);
    document.addEventListener('visibilitychange', startAudio);
    document.addEventListener('pointerdown', onFirstInteraction);
    document.addEventListener('touchstart', onFirstInteraction);
    document.addEventListener('keydown', onFirstInteraction);

    return () => {
      audio.pause();
      audio.remove();
      window.removeEventListener('load', startAudio);
      document.removeEventListener('visibilitychange', startAudio);
      document.removeEventListener('pointerdown', onFirstInteraction);
      document.removeEventListener('touchstart', onFirstInteraction);
      document.removeEventListener('keydown', onFirstInteraction);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(htmlPath, { cache: 'no-store' });
        if (!response.ok) throw new Error('page-not-found');
        const raw = await response.text();
        const doc = extractHtml(raw);

        if (!active) return;

        const title = doc.querySelector('title')?.textContent ?? '';
        document.title = title;

        document.querySelectorAll(`[${injectedStyleAttr}]`).forEach((n) => n.remove());
        document.querySelectorAll(`[${injectedScriptAttr}]`).forEach((n) => n.remove());

        const styles = [...doc.querySelectorAll('link[rel="stylesheet"]')];
        for (const link of styles) {
          const href = normalizeAssetPath(link.getAttribute('href'));
          if (!href) continue;
          const node = document.createElement('link');
          node.rel = 'stylesheet';
          node.href = href;
          node.setAttribute(injectedStyleAttr, 'true');
          document.head.appendChild(node);
        }

        const bodyHtml = doc.body.innerHTML;
        setHtml(bodyHtml);
        setNotFound(false);

        const scripts = [...doc.querySelectorAll('script[src]')]
          .map((s) => s.getAttribute('src'))
          .filter(Boolean);

        setTimeout(async () => {
          await loadScriptsSequentially(scripts);
          if (!active) return;
          runLegacyLoadLifecycle();
        }, 0);
      } catch (_err) {
        if (!active) return;
        setNotFound(true);
      }
    };

    load();

    return () => {
      active = false;
      document.querySelectorAll(`[${injectedScriptAttr}]`).forEach((n) => n.remove());
    };
  }, [htmlPath]);

  useEffect(() => {
    const clickHandler = (event) => {
      const anchor = event.target.closest('a[href]');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || /^(https?:|mailto:|tel:|javascript:)/i.test(href)) return;

      const htmlMatch = href.match(/^([^?#]+\.html)([?#].*)?$/i);
      if (!htmlMatch) return;

      const pageName = htmlMatch[1].replace(/^\//, '');
      const route = pageToRoute(pageName);
      if (!route) return;

      event.preventDefault();
      navigate(`${route}${htmlMatch[2] ?? ''}`);
    };

    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  }, [navigate]);

  if (notFound) return <div />;

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
