export const PAGES = [
  'index.html',
  'index-2.html',
  'index-3.html',
  'index-4.html',
  'index-5.html',
  'index-6.html',
  'index-7.html',
  'index-8.html',
  'index-9.html',
  'index-rtl.html',
  'invitation-1.html',
  'invitation-2.html',
  'about.html',
  'story.html',
  'story-2.html',
  'story-3.html',
  'story-4.html',
  'story-5.html',
  'story-6.html',
  'accomodation.html',
  'rsvp.html',
  'rsvp-2.html',
  'rsvp-3.html',
  'rsvp-4.html',
  'rsvp-5.html',
  'rsvp-6.html',
  'rsvp-7.html',
  'gallery.html',
  'planner.html',
  'team-single.html',
  'groom-bride.html',
  'service.html',
  'service-s2.html',
  'service-s3.html',
  'service-single.html',
  'pricing.html',
  'login.html',
  'register.html',
  'forgot.html',
  'coming.html',
  '404.html',
  'portfolio-grid.html',
  'portfolio-masonary.html',
  'portfolio-masonary-s2.html',
  'portfolio-masonary-s3.html',
  'portfolio-single.html',
  'shop-home.html',
  'shop-home-2.html',
  'shop-home-video-bg.html',
  'shop-home-3.html',
  'shop.html',
  'shop-single.html',
  'cart.html',
  'wishlist.html',
  'checkout.html',
  'contact.html',
  'blog.html',
  'blog-left-sidebar.html',
  'blog-fullwidth.html',
  'blog-single.html',
  'blog-single-left-sidebar.html',
  'blog-single-fullwidth.html'
];

export const pageToRoute = (page) => {
  if (page === 'index.html') return '/';
  return `/${page.replace(/\.html$/i, '')}`;
};

export const routeToPage = (routePath) => {
  const cleanPath = routePath.split('?')[0].split('#')[0];
  if (cleanPath === '/' || cleanPath === '') return 'index.html';
  const page = `${cleanPath.replace(/^\//, '')}.html`;
  return PAGES.includes(page) ? page : null;
};
