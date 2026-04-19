require "rgeo/geo_json"

class MapDataController < ApplicationController
  def problems
    factory = RGeo::GeoJSON::EntityFactory.instance

    problem_features = Problem.with_location.joins(:area).where(area: { published: true }).map do |problem|
      hash = {}.with_indifferent_access
      hash.merge!(problem.slice(:grade, :steepness, :featured, :popularity))
      hash[:id] = problem.id
      hash[:circuit_color] = problem.circuit&.color
      hash[:circuit_id] = problem.circuit_id_simplified
      hash[:circuit_number] = problem.circuit_number_simplified

      name_fr = I18n.with_locale(:fr) { problem.name_with_fallback }
      name_en = I18n.with_locale(:en) { problem.name_with_fallback }
      hash[:name] = name_fr
      hash[:name_en] = (name_en != name_fr) ? name_en : ""

      hash.deep_transform_keys! { |key| key.camelize(:lower) }
      factory.feature(problem.location, nil, hash)
    end

    boulder_features = Boulder.where.not(area_id: [45, 75, 79, 104, 113]).joins(:area).where(area: { published: true }).map do |boulder|
      factory.feature(boulder.polygon, nil, {})
    end

    feature_collection = factory.feature_collection(problem_features + boulder_features)
    render json: RGeo::GeoJSON.encode(feature_collection)
  end

  def areas
    factory = RGeo::GeoJSON::EntityFactory.instance

    area_features = []
    hull_features = []

    Area.published.each do |area|
      result = area.boulders.where(ignore_for_area_hull: false)
        .select("st_buffer(st_convexhull(st_collect(polygon::geometry)),0.00007) as hull, st_centroid(st_buffer(st_convexhull(st_collect(polygon::geometry)),0.00007))::geography as centroid")
        .to_a.first

      next unless result&.hull

      bounds_hash = {
        south_west_lat: area.bounds[:south_west].lat.to_s,
        south_west_lon: area.bounds[:south_west].lon.to_s,
        north_east_lat: area.bounds[:north_east].lat.to_s,
        north_east_lon: area.bounds[:north_east].lon.to_s,
      }.with_indifferent_access

      hull_props = { area_id: area.id }.with_indifferent_access.merge(bounds_hash)
      hull_props.deep_transform_keys! { |key| key.camelize(:lower) }
      hull_features << factory.feature(result.hull, nil, hull_props)

      area_props = { name: area.short_name || area.name, area_id: area.id, priority: area.priority }.with_indifferent_access.merge(bounds_hash)
      area_props.deep_transform_keys! { |key| key.camelize(:lower) }
      area_features << factory.feature(result.centroid, nil, area_props)
    end

    feature_collection = factory.feature_collection(area_features + hull_features)
    render json: RGeo::GeoJSON.encode(feature_collection)
  end

  def clusters
    factory = RGeo::GeoJSON::EntityFactory.instance

    cluster_features = []
    hull_features = []

    Cluster.all.each do |cluster|
      hull = Boulder.where(area_id: cluster.areas.map(&:id)).where(ignore_for_area_hull: false)
        .select("st_buffer(st_convexhull(st_collect(polygon::geometry)),0.00007) as hull")
        .to_a.first&.hull

      next unless hull

      hull_props = { cluster_id: cluster.id, name: cluster.name }.with_indifferent_access
      hull_props.deep_transform_keys! { |key| key.camelize(:lower) }
      hull_features << factory.feature(hull, nil, hull_props)

      if cluster.sw && cluster.ne && cluster.center
        point_props = {
          cluster_id: cluster.id,
          name: cluster.name,
          south_west_lat: cluster.sw.lat.to_s,
          south_west_lon: cluster.sw.lon.to_s,
          north_east_lat: cluster.ne.lat.to_s,
          north_east_lon: cluster.ne.lon.to_s,
        }.with_indifferent_access
        point_props.deep_transform_keys! { |key| key.camelize(:lower) }
        cluster_features << factory.feature(cluster.center, nil, point_props)
      end
    end

    feature_collection = factory.feature_collection(cluster_features + hull_features)
    render json: RGeo::GeoJSON.encode(feature_collection)
  end

  def pois
    factory = RGeo::GeoJSON::EntityFactory.instance

    poi_features = Poi.where.not(location: nil).map do |poi|
      hash = {
        type: poi.poi_type,
        name: poi.name,
        short_name: poi.short_name,
        google_url: poi.google_url,
      }.with_indifferent_access
      hash.deep_transform_keys! { |key| key.camelize(:lower) }
      factory.feature(poi.location, nil, hash)
    end

    feature_collection = factory.feature_collection(poi_features)
    render json: RGeo::GeoJSON.encode(feature_collection)
  end
end
