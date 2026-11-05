/* The 108 account in a tool's bar: one round button. Signed out it shows a person icon and opens the 108 sign-in
   (which comes back to the tool); signed in it shows your creature (./avatar) and opens your library on the site.
   The tool styles the button (its own round pill class); this only fills it and wires the click.

   import { mountAccountPill } from '@108-supply/kit/account-pill';
   mountAccountPill(document.querySelector('[data-account-pill]')!); */
import { account, type Account } from './account';
import { avatarSvg } from './avatar';

const PERSON =
  '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M230.92 212c-15.23-26.33-38.7-45.21-66.09-54.16a72 72 0 1 0-73.66 0c-27.39 8.94-50.86 27.82-66.09 54.16a8 8 0 1 0 13.85 8c18.84-32.56 52.14-52 89.07-52s70.23 19.44 89.07 52a8 8 0 1 0 13.85-8ZM72 96a56 56 0 1 1 56 56 56.06 56.06 0 0 1-56-56Z"/></svg>';

export function mountAccountPill(el: HTMLElement) {
  const render = (me: Account) => {
    el.classList.toggle('is-signed-in', me.signedIn);
    el.innerHTML = me.signedIn
      ? `<span class="account-pill-avatar" style="display:block;width:100%;height:100%;border-radius:50%;overflow:hidden">${avatarSvg(me.avatar || me.email || '108', 64).replace('<svg ', '<svg style="display:block;width:100%;height:100%" ')}</span>`
      : PERSON;
    const label = me.signedIn ? `Your 108 account${me.allAccess ? ' (All Access)' : ''}` : 'Sign in to 108';
    el.setAttribute('aria-label', label);
    el.title = label;
  };
  render(account.now);
  account.onChange(render);
  account.get();
  el.addEventListener('click', (e) => {
    e.preventDefault();
    if (account.now.signedIn) account.open('library');
    else account.signIn();
  });
}
