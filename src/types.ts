/**
 * Type definitions mirroring the Ganjoor REST API response shapes.
 *
 * These are intentionally permissive: the upstream API occasionally adds or omits
 * fields, and `unknown`-tolerant shapes keep the server working across those changes.
 */

/** A poet as returned by the lightweight `/api/ganjoor/poets` listing. */
export interface GanjoorPoetViewModel {
  id: number;
  name: string;
  description: string | null;
  fullUrl: string;
  rootCatId: number;
  nickname: string | null;
  published: boolean;
  imageUrl: string | null;
  birthYearInLHijri: number;
  validBirthDate: boolean;
  deathYearInLHijri: number;
  validDeathDate: boolean;
  pinOrder: number;
  birthPlace: string | null;
  birthPlaceLatitude: number | null;
  birthPlaceLongitude: number | null;
  deathPlace: string | null;
  deathPlaceLatitude: number | null;
  deathPlaceLongitude: number | null;
}

/** Rich poet record including biography; returned by `/api/ganjoor/poet`. */
export interface GanjoorPoet {
  id: number;
  name: string;
  description: string | null;
  nickname: string | null;
  rImage: string | null;
  rImageId: number | null;
  published: boolean;
  birthYearInLHijri: number;
  deathYearInLHijri: number;
  pinOrder: number;
  validBirthDate: boolean;
  validDeathDate: boolean;
  birthLocationId: number | null;
  birthLocation: string | null;
  deathLocationId: number | null;
  deathLocation: string | null;
}

/** Response shape of `GET /api/ganjoor/poet?url=` — poet plus their category tree. */
export interface GanjoorPoetPageViewModel {
  /** Upstream returns the same view-model shape as the poet listing here. */
  poet: GanjoorPoetViewModel;
  cats: GanjoorCatViewModel[];
}

export interface GanjoorCenturyViewModel {
  id: number;
  name: string;
  halfCenturyOrder: number;
  startYear: number;
  endYear: number;
  showInTimeLine: boolean;
  poets: GanjoorPoetViewModel[];
}

export interface GanjoorBookViewModel {
  id: number;
  name: string;
  fullUrl: string;
  poetId: number;
  poetName: string;
}

/**
 * Category type discriminator from the API enum `GanjoorCatType`.
 * 0 = General (misc), 1 = Poems, 2 = Book (a named diwan/collection).
 */
export enum GanjoorCatType {
  General = 0,
  Poems = 1,
  Book = 2,
}

export interface GanjoorCatViewModel {
  id: number;
  title: string;
  urlSlug: string;
  fullUrl: string;
  tableOfContentsStyle: number | null;
  catType: GanjoorCatType;
  description: string | null;
  descriptionHtml: string | null;
  mixedModeOrder: number | null;
  published: boolean;
  bookName: string | null;
  rImageId: number | null;
  sumUpSubsGeoLocations: string | null;
  mapName: string | null;
  next: string | null;
  previous: string | null;
  ancestors?: GanjoorCatViewModel[] | null;
  children: GanjoorCatViewModel[];
  poems?: GanjoorCategoryPoemRow[] | null;
  paperSources?: unknown[] | null;
  newImage?: unknown | null;
}

/**
 * Lightweight poem row as it appears inside a category's `poems` array.
 *
 * These rows carry only `id`, `title`, `urlSlug` and `excerpt` — no `fullUrl`,
 * `fullTitle` or `coupletsCount`. Build the full path from the category's own
 * `fullUrl` plus the poem's `urlSlug` when you need a link.
 */
export interface GanjoorCategoryPoemRow {
  id: number;
  title: string;
  urlSlug: string;
  excerpt: string | null;
  mainSections: unknown[] | null;
}

export interface GanjoorPoemViewModel {
  id: number;
  title: string;
  fullTitle: string;
  urlSlug: string;
  fullUrl: string;
  plainText: string;
  htmlText: string;
  sourceName: string | null;
  sourceUrlSlug: string | null;
  oldTag: string | null;
  oldTagPageUrl: string | null;
  mixedModeOrder: number | null;
  published: boolean;
  language: string | null;
  poemSummary: string | null;
  /**
   * With `catInfo=true` the API returns the enclosing category wrapped as
   * `{ poet, cat }`; the actual category record is at `.cat`.
   */
  category?: { poet?: GanjoorPoetViewModel; cat?: GanjoorCatViewModel } | null;
  next: PoemNavigation | null;
  previous: PoemNavigation | null;
  /** Only an array when `verseDetails=true`; an empty object upstream otherwise. */
  verses?: GanjoorVerse[] | Record<string, never> | null;
  recitations?: GanjoorRecitation[] | null;
  images?: unknown[] | null;
  songs?: unknown[] | null;
  comments?: GanjoorComment[] | null;
  sections?: unknown[] | null;
  geoDateTags?: unknown[] | null;
  top6QuotedPoems?: unknown[] | null;
  sectionIndex?: number | null;
  claimedByMultiplePoets?: boolean | null;
  coupletsCount?: number | null;
}

export interface GanjoorVerse {
  id: number;
  vOrder: number;
  coupletIndex: number;
  versePosition: number;
  sectionIndex1: number | null;
  sectionIndex2: number | null;
  sectionIndex3: number | null;
  sectionIndex4: number | null;
  text: string;
  languageId: number | null;
  coupletSummary: string | null;
  originalText: string | null;
}

/** Prev/next pointer returned by the poem endpoints when navigation is on. */
export interface PoemNavigation {
  id: number;
  title: string;
  urlSlug: string;
  excerpt: string | null;
  mainSections?: unknown[] | null;
}

/** Prev/next pointer returned by the poem endpoints when navigation is on. */
export interface PoemNavigation {
  id: number;
  title: string;
  urlSlug: string;
  excerpt: string | null;
  mainSections?: unknown[] | null;
}

/** Prev/next pointer returned by the poem endpoints when navigation is on. */
export interface PoemNavigation {
  id: number;
  title: string;
  urlSlug: string;
  excerpt: string | null;
  mainSections?: unknown[] | null;
}

export interface GanjoorMetre {
  id: number;
  urlSlug: string | null;
  rhythm: string;
  name: string | null;
  description: string | null;
  verseCount: number;
}

/**
 * Rhyme analysis result.
 *
 * The API returns `{ rhyme, failVerse }` on success, but a bare JSON string such
 * as "no sections" when the poem has no analysable sections.
 */
export interface GanjooRhymeAnalysisResult {
  rhyme: string | null;
  failVerse?: string | null;
}

export interface GanjoorSection {
  id: number;
  poemId: number;
  poem: unknown | null;
  poetId: number | null;
  poet: unknown | null;
  /** Upstream names this field `index`; the tool layer normalizes to section_index. */
  index: number;
  number: number;
  sectionType: number | null;
  verseType: number | null;
  ganjoorMetreId: number | null;
  ganjoorMetre: GanjoorMetre | null;
  rhymeLetters?: string | null;
  rhyme?: string | null;
  coupletsCount?: number | null;
  language?: string | null;
  cachedFirstCoupletIndex?: number | null;
  relatedSections?: GanjoorRelatedSection[] | null;
  verses?: GanjoorVerse[] | null;
  fullUrl?: string | null;
}

export interface GanjoorRelatedSection {
  id: number;
  poemId: number;
  sectionIndex: number;
  relationOrder: number;
  poetId: number | null;
  poetName: string | null;
  poetImageUrl?: string | null;
  fullUrl: string | null;
  section?: GanjoorSection | null;
}

/** One timed verse marker from `/api/audio/verses/{id}`. */
export interface GanjoorRecitationSyncPoint {
  verseOrder: number;
  verseText: string | null;
  audioStartMilliseconds: number;
}

export interface GanjoorRecitation {
  id: number;
  poemId: number | null;
  poemFullTitle: string | null;
  poemFullUrl: string | null;
  audioTitle: string | null;
  audioArtist: string | null;
  audioArtistUrl: string | null;
  audioSrc: string | null;
  audioSrcUrl: string | null;
  mp3FileCheckSum: string | null;
  mp3FilePath: string | null;
  publishDate: string | null;
  durationSeconds: number | null;
  reviewStatus: number | null;
  narrationId?: number | null;
  /** `ganjoor_get_poem_recitations` intentionally leaves text fields empty. */
  plainText?: string;
  htmlText?: string;
}

export interface GanjoorRecitationSyncInfo {
  id: number;
  poemId: number | null;
  poemFullTitle: string | null;
  poemFullUrl: string | null;
  audioTitle: string | null;
  audioArtist: string | null;
  audioSrc: string | null;
}

export interface GanjoorComment {
  id: number;
  poemId: number | null;
  poemTitle: string | null;
  poemUrl: string | null;
  coupletIndex: number | null;
  hasOwnerResponse: boolean;
  ownerResponse: string | null;
  ownerUserId: string | null;
  ownerUserName: string | null;
  ownerUserImageUrl: string | null;
  userId: string | null;
  userName: string | null;
  userImageUrl: string | null;
  text: string | null;
  sendDate: string | null;
  score: number | null;
  myRating?: number | null;
}

export interface GanjoorGeoTag {
  id: number;
  poemId: number | null;
  catId: number | null;
  topLevelCatId?: number | null;
  latitude: number | null;
  longitude: number | null;
  lunarDateTotalNumber: number | null;
  lunarDate: string | null;
  gregorianDate: string | null;
  /** Present on `cat/{id}/geotag` payloads. */
  childCat?: GanjoorCatViewModel | null;
}

/**
 * A quotation record linking two poems.
 *
 * The API returns the related poem's metadata under `cached*` keys rather than
 * a nested object, and includes the quoted couplet text on both sides.
 */
export interface GanjoorQuotedPoem {
  id: string;
  poemId: number;
  relatedPoemId: number;
  isPriorToRelated: boolean;
  chosenForMainList: boolean;
  sortOrder: number | null;
  cachedRelatedPoemPoetName: string | null;
  cachedRelatedPoemPoetUrl: string | null;
  cachedRelatedPoemFullTitle: string | null;
  cachedRelatedPoemFullUrl: string | null;
  cachedRelatedPoemPoetDeathYearInLHijri: number | null;
  coupletIndex: number | null;
  coupletVerse1: string | null;
  coupletVerse2: string | null;
  relatedCoupletIndex: number | null;
  relatedCoupletVerse1: string | null;
  relatedCoupletVerse2: string | null;
  note: string | null;
  published: boolean;
  claimedByBothPoets: boolean;
  indirectQuotation: boolean;
  samePoemsQuotedCount: number | null;
  rejected: boolean;
}

export interface GanjoorPerson {
  id: number;
  name: string;
  description: string | null;
  wikiUrl: string | null;
  birthYearInLHijri: number;
  deathYearInLHijri: number;
  validBirthDate: boolean;
  validDeathDate: boolean;
  birthLocationId: number | null;
  birthLocation: string | null;
  deathLocationId: number | null;
  deathLocation: string | null;
  machineGenerated: boolean;
  familyTreeCaption: string | null;
  importance: number;
  gender: number;
}

/**
 * A kinship edge as returned by `/api/people/{id}/relations`.
 *
 * The edge is stored from the *other* person's point of view:
 * `subjectIsPerson1` says whether the requested person is `person1`.
 */
export interface GanjoorPersonRelation {
  id: number;
  otherPersonId: number;
  otherPersonName: string | null;
  relationType: number;
  degreeHint: string | null;
  note: string | null;
  subjectIsPerson1: boolean;
  evidence?: Array<{
    id: number;
    poemId: number | null;
    coupletIndex: number | null;
    coupletText: string | null;
    masterCatTitle?: string | null;
    inferred?: boolean;
  }> | null;
}

/** Non-kinship tie (e.g. shared poem, contemporaneous) from the same endpoint. */
export interface GanjoorAffiliation {
  id: number;
  otherPersonId: number;
  otherPersonName: string | null;
  affiliationType: number;
  note: string | null;
}

/** Response of `/api/people/{id}/relations`. */
export interface GanjoorPersonRelationsViewModel {
  person: GanjoorPerson;
  relations: GanjoorPersonRelation[];
  affiliations: GanjoorAffiliation[];
}

/** Response of `/api/people/{id}/familytree`. */
export interface GanjoorFamilyTreeViewModel {
  rootId: number;
  /** Note the key is `persons`, not `people`. */
  persons: GanjoorPerson[];
  relations: Array<{ person1Id: number; person2Id: number; relationType: number; degreeHint: string | null }>;
}

export interface GanjoorFAQCategory {
  id: number;
  title: string;
  catOrder: number;
  description: string | null;
  published: boolean;
  items: GanjoorFAQItem[] | null;
}

/**
 * A FAQ entry. The API returns the body as `fullAnswer` (complete text) and
 * `answerExcerpt` (short preview) — there is no plain `answer` field.
 */
export interface GanjoorFAQItem {
  id: number;
  question: string;
  fullAnswer: string | null;
  answerExcerpt: string | null;
  pinned: boolean;
  pinnedItemOrder: number | null;
  categoryId: number;
  category: GanjoorFAQCategory | null;
  itemOrderInCategory: number | null;
  published: boolean;
}

/** One row from `/api/ganjoor/sections/tagged/language` — a full poem view model. */
export type GanjoorLanguageTaggedSection = GanjoorPoemViewModel;

export interface GanjoorCategoryWordCount {
  catId: number;
  catTitle?: string;
  totalWordCount: number;
  wordCount?: number;
}

/** Generic envelope returned by list endpoints that page server-side. */
export interface PagedList<T> {
  items: T[];
  page: number;
  page_size: number;
  /** Derived: whether another page likely exists (page * page_size < total). */
  has_more: boolean;
  next_page: number | null;
  /** Upstream sometimes reports a total; absent means unknown. */
  total?: number;
}

/** Standard shape returned by every tool when `response_format="json"`. */
export interface ToolResultData {
  [key: string]: unknown;
}
