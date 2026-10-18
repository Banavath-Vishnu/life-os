import React from 'react';
import Svg, { Polygon, Path, G } from 'react-native-svg';

/**
 * BrandLogo SVG Component
 * Custom geometric golden stag head inside a black octagon with a double golden border.
 * Replicates the StagHaus brand logo vectorially for sharp in-app scaling.
 */
export default function BrandLogo({ size = 120, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 500 500" style={style}>
      {/* Outer Octagon (Deep Black background) */}
      <Polygon
        points="146,40 354,40 460,146 460,354 354,460 146,460 40,354 40,146"
        fill="#09090B"
      />
      
      {/* Outer Octagon Gold Border */}
      <Polygon
        points="146,40 354,40 460,146 460,354 354,460 146,460 40,354 40,146"
        fill="none"
        stroke="#F1C40F"
        strokeWidth="10"
        strokeLinejoin="round"
      />
      
      {/* Inner Octagon Gold Border */}
      <Polygon
        points="151,52 349,52 448,151 448,349 349,448 151,448 52,349 52,151"
        fill="none"
        stroke="#F1C40F"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* Gold Stag Head Path */}
      <G fill="#F1C40F">
        {/* Forehead and snout/bridge */}
        <Path 
          d="M 235 240 
             L 265 240 
             L 268 290 
             L 257 325 
             L 257 332 
             C 257 335, 243 335, 243 332 
             L 243 325 
             L 232 290 Z" 
        />
        
        {/* Nose nostrils cutout */}
        <Path 
          d="M 245 328 
             C 245 325, 255 325, 255 328 
             C 255 331, 245 331, 245 328 Z" 
          fill="#09090B" 
        />
        
        {/* Left Eye */}
        <Path 
          d="M 222 262 
             C 220 260, 230 257, 234 261 
             C 236 263, 226 266, 222 262 Z" 
        />
        {/* Right Eye */}
        <Path 
          d="M 278 262 
             C 280 260, 270 257, 266 261 
             C 264 263, 274 266, 278 262 Z" 
        />
        
        {/* Left Ear */}
        <Path 
          d="M 215 257 
             C 190 262, 182 282, 205 287 
             C 220 282, 222 272, 215 257 Z" 
        />
        {/* Left Ear Inner Cutout */}
        <Path 
          d="M 211 264 
             C 196 268, 192 278, 205 281 
             C 213 279, 214 272, 211 264 Z" 
          fill="#09090B" 
        />

        {/* Right Ear */}
        <Path 
          d="M 285 257 
             C 310 262, 318 282, 295 287 
             C 280 282, 278 272, 285 257 Z" 
        />
        {/* Right Ear Inner Cutout */}
        <Path 
          d="M 289 264 
             C 304 268, 308 278, 295 281 
             C 287 279, 286 272, 289 264 Z" 
          fill="#09090B" 
        />

        {/* Neck/Chest V-Shape */}
        <Path 
          d="M 226 338 
             L 274 338 
             L 264 380 
             L 250 415 
             L 236 380 Z" 
        />
        {/* Neck Inner Cutout */}
        <Path 
          d="M 234 343 
             L 266 343 
             L 258 375 
             L 250 398 
             L 242 375 Z" 
          fill="#09090B" 
        />

        {/* Antlers Left */}
        {/* Main beam left */}
        <Path 
          d="M 226 235 
             C 210 200, 180 180, 195 140 
             C 200 130, 215 150, 210 170 
             C 205 185, 220 200, 232 230 Z" 
        />
        {/* Outer Tines Left */}
        <Path 
          d="M 183 175 
             C 150 190, 160 215, 185 200 
             C 195 195, 190 185, 183 175 Z" 
        />
        <Path 
          d="M 205 150 
             C 190 120, 210 100, 220 125 
             C 225 135, 215 145, 205 150 Z" 
        />
        <Path 
          d="M 225 180 
             C 210 160, 235 130, 240 160 
             C 242 168, 230 175, 225 180 Z" 
        />

        {/* Antlers Right */}
        {/* Main beam right */}
        <Path 
          d="M 274 235 
             C 290 200, 320 180, 305 140 
             C 300 130, 285 150, 290 170 
             C 295 185, 280 200, 268 230 Z" 
        />
        {/* Outer Tines Right */}
        <Path 
          d="M 317 175 
             C 350 190, 340 215, 315 200 
             C 305 195, 310 185, 317 175 Z" 
        />
        <Path 
          d="M 295 150 
             C 310 120, 290 100, 280 125 
             C 275 135, 285 145, 295 150 Z" 
        />
        <Path 
          d="M 275 180 
             C 290 160, 265 130, 260 160 
             C 258 168, 270 175, 275 180 Z" 
        />
      </G>
    </Svg>
  );
}
