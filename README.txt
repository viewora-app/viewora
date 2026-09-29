VIEWORA LANGUAGE + FONT FIX

Replace these files in the root of your Viewora website:
1. theme.js
2. settings.js
3. settings.html
4. firebase.js
5. index.html

What is fixed:
- Language preference is stored consistently in localStorage.
- Language is applied globally on pages that load firebase.js/theme.js.
- Dynamically-created Settings rows are re-translated after a language change.
- Common Viewora UI phrases have expanded translations.
- Japanese, Hindi, Chinese, Korean, French, Spanish, German, Arabic,
  Portuguese, Russian and Sanskrit common UI translations are included.
- Font Size now visibly scales px-based Viewora UI instead of only changing
  the html root font-size.
- Default / Large / Extra large remain persistent across pages.
- firebase.js automatically loads theme.js for pages that already use
  firebase.js, while theme.js prevents duplicate execution.

IMPORTANT:
Clear browser cache/site data or do a hard refresh after uploading.
On Android Chrome, reopen the Viewora page after deployment.

TEST:
Settings -> Appearance -> Language -> हिन्दी or 日本語 -> Save.
Then open Home, Shorts, Profile and another page.
Settings -> Appearance -> Font Size -> Large / Extra large -> Save.
Open another page and verify the scale remains.
