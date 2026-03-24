#!/usr/bin/env node
// tools/structured-data-generator.mjs
// Usage: node tools/structured-data-generator.mjs <directory> --type=<Organization|Product|FAQPage|HowTo|SoftwareApplication>

import fs from 'fs';
import path from 'path';

const dir = process.argv[2] || '.';
const absDir = path.resolve(dir);

const typeArg = process.argv.find(a => a.startsWith('--type='));
const schemaType = typeArg ? typeArg.replace('--type=', '') : 'Organization';

const validTypes = ['Organization', 'SoftwareApplication', 'Product', 'FAQPage', 'HowTo'];
const resolvedType = validTypes.includes(schemaType) ? schemaType : 'Organization';

// Read package.json
let pkgName = 'Unknown';
let pkgDescription = '';
let pkgHomepage = '';

const pkgPath = path.join(absDir, 'package.json');
if (fs.existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkgName = pkg.name || pkgName;
    pkgDescription = pkg.description || '';
    pkgHomepage = pkg.homepage || '';
  } catch {}
}

function buildSchema(type) {
  const base = {
    '@context': 'https://schema.org',
    '@type': type,
  };

  switch (type) {
    case 'Organization':
      return {
        ...base,
        name: pkgName,
        description: pkgDescription,
        url: pkgHomepage,
      };

    case 'SoftwareApplication':
      return {
        ...base,
        name: pkgName,
        description: pkgDescription,
        url: pkgHomepage,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      };

    case 'Product':
      return {
        ...base,
        name: pkgName,
        description: pkgDescription,
        url: pkgHomepage,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
      };

    case 'FAQPage':
      return {
        ...base,
        mainEntity: [
          {
            '@type': 'Question',
            name: `What is ${pkgName}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: pkgDescription || `${pkgName} is a software application.`,
            },
          },
        ],
      };

    case 'HowTo':
      return {
        ...base,
        name: `How to use ${pkgName}`,
        description: pkgDescription,
        step: [
          {
            '@type': 'HowToStep',
            name: 'Install',
            text: `Install ${pkgName} using your package manager.`,
          },
          {
            '@type': 'HowToStep',
            name: 'Configure',
            text: `Configure ${pkgName} according to your needs.`,
          },
          {
            '@type': 'HowToStep',
            name: 'Run',
            text: `Run ${pkgName} to get started.`,
          },
        ],
      };

    default:
      return { ...base, name: pkgName, description: pkgDescription };
  }
}

const schema = buildSchema(resolvedType);

const publicDir = path.join(absDir, 'public');
const outDir = fs.existsSync(publicDir) ? publicDir : absDir;
const outPath = path.join(outDir, 'schema.json');

fs.writeFileSync(outPath, JSON.stringify(schema, null, 2), 'utf8');

const relPath = path.relative(absDir, outPath);
console.log(JSON.stringify({ path: relPath, type: resolvedType, written: true }));
