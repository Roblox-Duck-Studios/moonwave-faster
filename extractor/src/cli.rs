use std::path::PathBuf;

use clap::Parser;

#[derive(Debug, Parser)]
#[command(about = env!("CARGO_PKG_DESCRIPTION"), version)]
pub struct Args {
    #[command(subcommand)]
    pub subcommand: Subcommand,
}

#[derive(Debug, clap::Subcommand)]
pub enum Subcommand {
    Extract(ExtractSubcommand),
}

/// Extracts doc comments from the given files
#[derive(Debug, clap::Args)]
pub struct ExtractSubcommand {
    pub input_path: Option<PathBuf>,

    /// The base path that source paths in the output will be relative to.
    /// If unspecified, the input path is used.
    #[arg(long = "base", short = 'b')]
    pub base_path: Option<PathBuf>,
}
