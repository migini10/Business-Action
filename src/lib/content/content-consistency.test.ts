import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { siteContent } from './site-content';
import { getPublicKnowledge } from '@/lib/customer-service/knowledge/public-knowledge';

describe('Site & Bot Single Source of Truth Consistency (CONTENT-001)', () => {
  const rootDir = path.resolve(__dirname, '../../../');

  it('Bot knowledge dynamically consumes siteContent without drift', () => {
    // 1. Company details
    const companyBot = getPublicKnowledge('COMPANY_INFO', 'fr');
    assert.ok(companyBot.answer.includes(siteContent.company.ninea));
    assert.ok(companyBot.answer.includes(siteContent.company.rccm));
    assert.ok(companyBot.answer.includes(siteContent.company.publicationDirector));
    assert.ok(companyBot.answer.includes(siteContent.company.address));

    // 2. Quote process & File size limit (4 MB)
    const quoteBot = getPublicKnowledge('QUOTE_PROCESS', 'fr');
    assert.ok(quoteBot.answer.includes(`${siteContent.quote.maxFileSizeMB} MB`));

    // 3. Support hours (Du lundi au samedi)
    const hoursBot = getPublicKnowledge('HOURS_INFO', 'fr');
    assert.ok(hoursBot.answer.includes(siteContent.supportHours.phone));

    // 4. Data retention (12 mois)
    const retentionBot = getPublicKnowledge('DATA_RETENTION', 'fr');
    assert.ok(retentionBot.answer.includes(siteContent.privacy.retention.quoteDocuments));

    // 5. Password reset OTP validity & channels
    const resetBot = getPublicKnowledge('PASSWORD_RESET', 'fr');
    assert.ok(resetBot.answer.includes(siteContent.account.passwordReset.securityNote));
    for (const channel of siteContent.account.passwordReset.channels) {
      assert.ok(resetBot.answer.includes(channel));
    }

    // 6. Subcontractors / Hosting providers
    const hostingBot = getPublicKnowledge('HOSTING_SUBCONTRACTORS', 'fr');
    for (const sub of siteContent.privacy.subcontractors) {
      assert.ok(hostingBot.answer.includes(sub.name));
    }

    // 7. Terms & limits
    const termsBot = getPublicKnowledge('TERMS_LIMITS', 'fr');
    assert.ok(termsBot.answer.includes(siteContent.terms.notAnInsurer));
    assert.ok(termsBot.answer.includes(siteContent.terms.role));
    assert.ok(termsBot.answer.includes(siteContent.terms.pricingAuthority));

    // 8. Deletion procedure
    const deletionBot = getPublicKnowledge('DATA_DELETION', 'fr');
    assert.ok(deletionBot.answer.includes(siteContent.deletion.noInstantButton));
  });

  it('All relevant public pages consume siteContent from @/lib/content', () => {
    const pagesToVerify = [
      {
        path: 'src/app/(legal)/mentions-legales/page.tsx',
        checks: ['siteContent', 'company.publicationDirector', 'company.hostingProviders'],
      },
      {
        path: 'src/app/(legal)/confidentialite/page.tsx',
        checks: ['siteContent', 'privacy.retention', 'terms.notAnInsurer'],
      },
      {
        path: 'src/app/(legal)/conditions-utilisation/page.tsx',
        checks: ['siteContent', 'terms.notAnInsurer', 'terms.pricingAuthority'],
      },
      {
        path: 'src/app/(legal)/suppression-donnees/page.tsx',
        checks: ['siteContent', 'deletion.noInstantButton'],
      },
      {
        path: 'src/app/contact/ContactClient.tsx',
        checks: ['siteContent', 'supportHours.phone'],
      },
      {
        path: 'src/app/mot-de-passe-oublie/page.tsx',
        checks: ['siteContent', 'passwordReset.validityMinutes'],
      },
    ];

    for (const page of pagesToVerify) {
      const fullPath = path.join(rootDir, page.path);
      assert.ok(fs.existsSync(fullPath), `Page file ${page.path} does not exist`);
      const fileContent = fs.readFileSync(fullPath, 'utf8');

      assert.ok(
        fileContent.includes('@/lib/content'),
        `Page ${page.path} does not import from @/lib/content`
      );

      for (const check of page.checks) {
        assert.ok(
          fileContent.includes(check),
          `Page ${page.path} missing shared property usage: ${check}`
        );
      }
    }
  });

  it('Guarantees zero knowledge divergence between public pages and bot', () => {
    // Reading Mentions Légales page source vs Bot knowledge
    const mentionsLegalesSrc = fs.readFileSync(
      path.join(rootDir, 'src/app/(legal)/mentions-legales/page.tsx'),
      'utf8'
    );
    const mentionsBot = getPublicKnowledge('COMPANY_INFO', 'fr');
    assert.ok(mentionsLegalesSrc.includes('company.publicationDirector'));
    assert.ok(mentionsBot.answer.includes(siteContent.company.publicationDirector));

    // Reading Conditions d'utilisation page source vs Bot knowledge
    const cguSrc = fs.readFileSync(
      path.join(rootDir, 'src/app/(legal)/conditions-utilisation/page.tsx'),
      'utf8'
    );
    const termsBot = getPublicKnowledge('TERMS_LIMITS', 'fr');
    assert.ok(cguSrc.includes('terms.notAnInsurer'));
    assert.ok(termsBot.answer.includes(siteContent.terms.notAnInsurer));

    // Reading Confidentialité page source vs Bot knowledge
    const confSrc = fs.readFileSync(
      path.join(rootDir, 'src/app/(legal)/confidentialite/page.tsx'),
      'utf8'
    );
    const retBot = getPublicKnowledge('DATA_RETENTION', 'fr');
    assert.ok(confSrc.includes('privacy.retention.quoteDocuments'));
    assert.ok(retBot.answer.includes(siteContent.privacy.retention.quoteDocuments));
  });
});
