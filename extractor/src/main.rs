use clap::Parser;
use libmoonwave::{generate_docs_from_path, Args, Subcommand};
use std::env::current_dir;

fn run(args: Args) -> anyhow::Result<()> {
    match args.subcommand {
        Subcommand::Extract(subcommand) => {
            let path = match subcommand.input_path {
                Some(path) => path,
                None => current_dir()?,
            };

            let base_path = match subcommand.base_path {
                Some(path) => path,
                None => path.clone(),
            };

            generate_docs_from_path(&path, &base_path)
        }
    }
}

fn main() {
    let args = Args::parse();

    if let Err(error) = run(args) {
        eprintln!("error: {}", error);
        std::process::exit(1);
    }
}
