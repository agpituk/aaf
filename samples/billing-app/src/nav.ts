export function initNav(): void {
  const path = window.location.pathname;
  document.querySelectorAll<HTMLAnchorElement>('nav a[href]').forEach((a) => {
    const href = a.getAttribute('href')!;
    if (path === href || (href !== '/' && path.startsWith(href))) {
      a.classList.add('active');
    }
  });
}
