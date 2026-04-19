{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          pg = pkgs.postgresql_16;
          postgis = pkgs.postgresql16Packages.postgis;
          pgWithPostgis = pg.withPackages (_: [ postgis ]);
        in
        {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              ruby_3_3
              libyaml
              zlib
              openssl

              pgWithPostgis
              libpq

              libxml2
              libxslt
              pkg-config
              gcc
              gnumake

              vips
              sqlite

              overmind
            ];

            env = {
              FREEDESKTOP_MIME_TYPES_PATH = "${pkgs.shared-mime-info}/share/mime/packages/freedesktop.org.xml";
            };

            shellHook = ''
              export GEM_HOME="$PWD/.gems"
              export PATH="$GEM_HOME/bin:$HOME/.local/share/gem/ruby/3.3.0/bin:$PATH"

              export PGDATA="$PWD/.pgdata"
              export PGHOST="$PWD/.pgdata"
              export DATABASE_URL="postgresql:///dump-prod?host=$PGDATA"

              if [ ! -d "$PGDATA" ]; then
                echo "Initializing PostgreSQL database..."
                initdb --no-locale --encoding=UTF8 -D "$PGDATA"
                echo "unix_socket_directories = '$PGDATA'" >> "$PGDATA/postgresql.conf"
                echo "listen_addresses = '''" >> "$PGDATA/postgresql.conf"
                pg_ctl -D "$PGDATA" -l "$PGDATA/postgresql.log" start
                createdb dump-prod
                psql -d dump-prod -c "CREATE EXTENSION IF NOT EXISTS postgis;"
                createdb boolder-test
                psql -d boolder-test -c "CREATE EXTENSION IF NOT EXISTS postgis;"
              fi

              if ! pg_ctl -D "$PGDATA" status > /dev/null 2>&1; then
                pg_ctl -D "$PGDATA" -l "$PGDATA/postgresql.log" start
              fi
            '';
          };
        });
    };
}
