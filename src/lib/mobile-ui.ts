export function getAccueilHref(pathname: string): string {
  if (pathname.startsWith('/admin')) {
    return '/admin';
  }
  if (pathname.startsWith('/espace-client')) {
    return '/espace-client';
  }
  return '/';
}

export function getSidebarClasses(isMobileDrawerOpen: boolean): string {
  return `admin-sidebar ${isMobileDrawerOpen ? 'open' : ''}`.trim();
}

export function getWhatsappGridClasses(hasConversation: boolean): string {
  return `whatsapp-grid ${hasConversation ? 'has-conv' : ''}`.trim();
}

export function shouldAutoScroll(scrollTop: number, scrollHeight: number, clientHeight: number): boolean {
  const distanceToBottom = scrollHeight - scrollTop - clientHeight;
  return distanceToBottom <= 150;
}
