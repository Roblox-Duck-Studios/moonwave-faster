import fs from "fs-extra"
import path from "path"
import { ClassOrder, Config, FoldersEnabled } from "./prepareProject.js"

export interface GenerateConfigParams {
  codePaths: string[]
  enablePlugins: FoldersEnabled
  config: Config
  customCssExists: boolean
  customSidebarExists: boolean
  changelogExists: boolean
  projectDir: string
  binaryPath: string
  classOrder: ClassOrder
  apiCategories: string[]
  autoSectionPath?: string
}

type FlagGroup = boolean | Record<string, boolean> | undefined

// Turns every Docusaurus Faster flag on, except ones the user set themselves.
// (Docusaurus treats unset keys in an object as `false`, so we can't just
// pass the user's object through.)
function mergeFasterFlags(userFlags: FlagGroup): FlagGroup {
  if (typeof userFlags === "boolean") {
    return userFlags
  }

  const flags = { ...userFlags }

  // The persistent cache only works with the Rspack bundler
  if (flags.rspackBundler === false) {
    flags.rspackPersistentCache ??= false
  }

  for (const key of FASTER_FLAGS) {
    flags[key] ??= true
  }

  return flags
}

// SSG worker threads (part of Faster) need this v4 flag. We only turn on this
// one flag rather than all of v4, since v4 also changes CSS cascade layers.
function mergeV4Flags(userFlags: FlagGroup): FlagGroup {
  if (typeof userFlags === "boolean") {
    return userFlags
  }

  return { removeLegacyPostBuildHeadAttribute: true, ...userFlags }
}

const FASTER_FLAGS = [
  "swcJsLoader",
  "swcJsMinimizer",
  "swcHtmlMinimizer",
  "lightningCssMinimizer",
  "mdxCrossCompilerCache",
  "rspackBundler",
  "rspackPersistentCache",
  "ssgWorkerThreads",
  "gitEagerVcs",
] as const

export default function getDocusaurusConfig({
  codePaths,
  enablePlugins,
  config,
  customCssExists,
  customSidebarExists,
  changelogExists,
  projectDir,
  binaryPath,
  classOrder,
  apiCategories,
  autoSectionPath,
}: GenerateConfigParams) {
  const gitRepoUrl = config.gitRepoUrl

  const validCodePaths = codePaths
    .map((codePath) => path.join(process.cwd(), codePath))
    .filter((codePath) => fs.existsSync(codePath))

  return {
    onBrokenLinks: "throw",
    url: `https://${config.docusaurus?.organizationName}.github.io`,

    markdown: {
      hooks: {
        onBrokenMarkdownLinks: "warn",
      },
    },

    ...config.docusaurus,

    // Docusaurus Faster: Rspack instead of webpack, SWC instead of Babel,
    // LightningCSS for CSS minifying, and a persistent Rspack build cache.
    // Projects can still opt out of single flags from moonwave.toml, e.g.
    // [docusaurus.future.faster] rspackBundler = false
    future: {
      ...config.docusaurus?.future,
      v4: mergeV4Flags(config.docusaurus?.future?.v4),
      faster: mergeFasterFlags(config.docusaurus?.future?.faster),
    },

    customFields: {
      bannerImage: config.home?.bannerImage
    },

    themeConfig: {
      prism: {
        additionalLanguages: [
          "lua",
          "bash",
          "css",
          "javascript",
          "diff",
          "git",
          "json",
          "typescript",
          "toml",
        ],
      },

      navbar: {
        ...config.navbar,

        items: [
          ...(enablePlugins.docs
            ? [
                {
                  type: "doc",
                  docId: "intro",
                  position: "left",
                  label: "Docs",
                },
              ]
            : []),
          ...(enablePlugins.blog
            ? [{ to: "/blog", label: "Blog", position: "left" }]
            : []),
          ...(validCodePaths.length > 0
            ? [{ to: "/api/", label: "API", position: "left" }]
            : []),
          ...(changelogExists
            ? [{ to: "/changelog", label: "Changelog", position: "left" }]
            : []),
          ...(config?.navbar?.items || []),
          ...(gitRepoUrl
            ? [
                {
                  href: gitRepoUrl,
                  label: "GitHub",
                  position: "right",
                },
              ]
            : []),
        ],
      },
      footer: {
        style: "dark",
        copyright: `Copyright © ${new Date().getFullYear()} ${
          config.docusaurus?.organizationName ?? ""
        }. Built with Moonwave and Docusaurus.`,
        ...config.footer,
      },

      colorMode: {
        respectPrefersColorScheme: true,
      },
    },
    plugins: [
      [
        "docusaurus-plugin-moonwave",
        {
          id: "moonwave",
          code: validCodePaths,
          sourceUrl: gitRepoUrl + `/blob/${config.gitSourceBranch ?? "master"}`,
          projectDir,
          classOrder,
          apiCategories,
          binaryPath,
          autoSectionPath,
        },
      ],
    ],
    themes: [
      [
        "@easyops-cn/docusaurus-search-local",
        {
          hashed: true,
        },
      ],
    ],
    presets: [
      [
        "@docusaurus/preset-classic",
        {
          docs: enablePlugins.docs
            ? {
                // Please change this to your repo.
                editUrl: gitRepoUrl
                  ? `${gitRepoUrl}/edit/${config.gitSourceBranch ?? "master"}/`
                  : undefined, // Omitting this variable entirely will disable edit links
                sidebarCollapsible: true,
                sidebarPath: customSidebarExists
                  ? "./src/sidebars.js"
                  : undefined,
              }
            : false,
          blog: enablePlugins.blog
            ? {
                showReadingTime: true,
                // Please change this to your repo.
                editUrl: gitRepoUrl
                  ? `${gitRepoUrl}/edit/${config.gitSourceBranch ?? "master"}/`
                  : undefined, // Omitting this variable entirely will disable edit links
              }
            : false,
          pages: {
            path: "pages",

            //exclude any file starting with an underscore
            exclude: ["_*.*"],
          },
          theme: {
            customCss: [
              "src/css/moonwave.css",
              ...(customCssExists ? ["src/css/custom.css"] : []),
            ],
          },
        },
      ],
    ],
  }
}
